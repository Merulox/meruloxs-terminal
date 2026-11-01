#!/usr/bin/env bash
# Transactionally rebuild public/audio/ from the gitignored audio/ source.
#
# Every published MP3 is content-addressed, so changed bytes always receive a
# new URL and cannot be confused with a stale Cloudflare/browser cache entry.
# Known slugs get curated metadata; unknown slugs receive a title derived from
# their filename and remain playable without a script update.
set -euo pipefail

ROOT_DIR="${BGM_ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$ROOT_DIR"

SRC_DIR="${BGM_SRC_DIR:-audio}"
OUT_DIR="${BGM_OUT_DIR:-public/audio}"
BITRATE="${BGM_BITRATE:-160k}"

declare -A TITLES=(
	[gym-class-v2]="Gym Class"
	[ether]="Éther tune"
)
declare -A ARTISTS=(
	[gym-class-v2]="Lil Peep"
	[ether]="Takeshi Kobayashi & Yui Makino"
)
declare -A START_OFFSET=(
	[gym-class-v2]="15"
)

if [[ ! -d "$SRC_DIR" ]]; then
	echo "no $SRC_DIR/ directory found" >&2
	exit 1
fi

out_parent=$(dirname "$OUT_DIR")
out_name=$(basename "$OUT_DIR")
mkdir -p "$out_parent"
build_dir=$(mktemp -d "$out_parent/.${out_name}.build.XXXXXX")
backup_dir=""

cleanup() {
	rm -rf "$build_dir"
	if [[ -n "$backup_dir" && -e "$backup_dir" && ! -e "$OUT_DIR" ]]; then
		mv "$backup_dir" "$OUT_DIR"
	fi
}
trap cleanup EXIT

manifest_entries=()
declare -A seen_slugs=()

while IFS= read -r -d '' source_file; do
	base=$(basename "$source_file")
	slug="${base%.*}"
	mime=$(file --brief --mime-type "$source_file" 2>/dev/null || true)
	case "$mime" in
		audio/*) ;;
		*) echo "skip (not audio): $source_file" >&2; continue ;;
	esac

	if [[ -n "${seen_slugs[$slug]:-}" ]]; then
		echo "duplicate audio slug '$slug' from '$source_file' and '${seen_slugs[$slug]}'" >&2
		exit 1
	fi
	seen_slugs[$slug]="$source_file"

	encoded_file="$build_dir/.encoded-${#manifest_entries[@]}.mp3"
	offset="${START_OFFSET[$slug]:-0}"
	if ! ffmpeg -y -nostdin -loglevel error -ss "$offset" -i "$source_file" \
		-vn -b:a "$BITRATE" -ar 44100 "$encoded_file"; then
		echo "failed to convert: $source_file" >&2
		exit 1
	fi

	content_hash=$(sha256sum "$encoded_file" | cut -d' ' -f1)
	output_name="${content_hash:0:20}.mp3"
	if [[ -e "$build_dir/$output_name" ]]; then
		rm "$encoded_file"
	else
		mv "$encoded_file" "$build_dir/$output_name"
	fi

	title="${TITLES[$slug]:-}"
	artist="${ARTISTS[$slug]:-}"
	if [[ -z "$title" ]]; then
		title=$(printf '%s' "$slug" | sed 's/-/ /g; s/\b\(.\)/\u\1/g')
		echo "no curated title for slug '$slug', using derived title '$title'" >&2
	fi

	manifest_entries+=("$(node -e '
		const [slug, title, artist, src] = process.argv.slice(1);
		process.stdout.write(JSON.stringify({ slug, title, artist, src }));
	' "$slug" "$title" "$artist" "/audio/$output_name")")
	echo "built: $build_dir/$output_name"
done < <(find "$SRC_DIR" -maxdepth 1 -type f -print0 | sort -z)

{
	printf '[\n'
	for idx in "${!manifest_entries[@]}"; do
		separator=","
		[[ "$idx" -eq $((${#manifest_entries[@]} - 1)) ]] && separator=""
		printf '  %s%s\n' "${manifest_entries[$idx]}" "$separator"
	done
	printf ']\n'
} > "$build_dir/manifest.json"

# shellcheck disable=SC2016 # JavaScript template literals, not shell expansion.
node -e '
	const fs = require("node:fs");
	const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
	if (!Array.isArray(manifest)) throw new Error("audio manifest is not an array");
	for (const track of manifest) {
		if (!track.slug || !track.title || !track.src) throw new Error("invalid audio manifest entry");
		const filename = track.src.replace(/^\/audio\//, "");
		if (!/^[a-f0-9]{20}\.mp3$/.test(filename)) throw new Error(`non-content-addressed source: ${track.src}`);
		if (!fs.existsSync(`${process.argv[2]}/${filename}`)) throw new Error(`missing output: ${track.src}`);
	}
' "$build_dir/manifest.json" "$build_dir"

if [[ -e "$OUT_DIR" ]]; then
	backup_dir="${OUT_DIR}.backup.$$"
	rm -rf "$backup_dir"
	mv "$OUT_DIR" "$backup_dir"
fi
mv "$build_dir" "$OUT_DIR"
build_dir=""
rm -rf "$backup_dir"
backup_dir=""
trap - EXIT

echo "wrote $OUT_DIR/manifest.json (${#manifest_entries[@]} tracks)"
