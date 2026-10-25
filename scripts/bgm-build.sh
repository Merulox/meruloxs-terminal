#!/usr/bin/env bash
# Rebuilds public/audio/ from the audio/ source directory.
#
# audio/ (repo root, gitignored, not web-servable) is the canonical track
# source: drop a named file in as <slug>.<ext> (any format ffmpeg reads) and
# it becomes the background-music player's <slug> track. Known slugs get a
# curated title/artist below; unknown slugs still work (derived title from
# the filename) so a new track never silently fails to appear, it just gets
# a plain fallback label until this script is updated with real metadata.
#
# Output: public/audio/<slug>.mp3 (normalized to a consistent bitrate,
# committed to git) + public/audio/manifest.json (list of
# { slug, title, artist, src } for tracks the player can actually find —
# missing slugs are simply absent, not placeholders, so the player's
# fallback logic only ever sees real, playable tracks).
#
# Safe to re-run anytime after adding/removing files in audio/.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

SRC_DIR="audio"
OUT_DIR="public/audio"
BITRATE="160k"

declare -A TITLES=(
	[gym-class]="Gym Class"
	[ether]="Éther tune"
)
declare -A ARTISTS=(
	[gym-class]="Lil Peep"
	[ether]="Takeshi Kobayashi & Yui Makino"
)

if [[ ! -d "$SRC_DIR" ]]; then
	echo "no $SRC_DIR/ directory found" >&2
	exit 1
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

manifest_entries=()

while IFS= read -r -d '' f; do
	base=$(basename "$f")
	slug="${base%.*}"
	mime=$(file --brief --mime-type "$f" 2>/dev/null || echo "")
	case "$mime" in
		audio/*) ;;
		*) echo "skip (not audio): $f" >&2; continue ;;
	esac

	out="$OUT_DIR/$slug.mp3"
	if ! ffmpeg -y -loglevel error -i "$f" -vn -b:a "$BITRATE" -ar 44100 "$out"; then
		echo "failed to convert: $f" >&2
		continue
	fi

	title="${TITLES[$slug]:-}"
	artist="${ARTISTS[$slug]:-}"
	if [[ -z "$title" ]]; then
		title=$(echo "$slug" | sed 's/-/ /g; s/\b\(.\)/\u\1/g')
		echo "no curated title for slug '$slug', using derived title '$title'" >&2
	fi

	manifest_entries+=("{\"slug\":\"$slug\",\"title\":\"$(echo "$title" | sed 's/"/\\"/g')\",\"artist\":\"$(echo "$artist" | sed 's/"/\\"/g')\",\"src\":\"/audio/$slug.mp3\"}")
	echo "built: $out"
done < <(find "$SRC_DIR" -maxdepth 1 -type f -print0 | sort -z)

{
	printf '[\n'
	for idx in "${!manifest_entries[@]}"; do
		sep=","
		[[ "$idx" -eq $((${#manifest_entries[@]} - 1)) ]] && sep=""
		printf '  %s%s\n' "${manifest_entries[$idx]}" "$sep"
	done
	printf ']\n'
} > "$OUT_DIR/manifest.json"

echo "wrote $OUT_DIR/manifest.json (${#manifest_entries[@]} tracks)"
