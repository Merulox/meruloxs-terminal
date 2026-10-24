#!/usr/bin/env bash
# Rebuilds public/moodboard/ from the moodboard/ source directory.
#
# moodboard/ (repo root, gitignored, not web-servable) is the canonical,
# human-curated image source. Any file directly inside moodboard/ is
# "general" category; any file inside a moodboard/<name>/ subdirectory is
# categorized under <name> (e.g. moodboard/lil-peep/*.png -> category
# "lil-peep"). Subdirectories are not recursed further.
#
# Output: public/moodboard/<category-or-general>/<NN>.webp (optimized,
# resized, committed to git) + public/moodboard/manifest.json (ordered
# list of { src, category } consumed by the autoscroll strip on /music).
#
# Safe to re-run anytime after adding/removing files in moodboard/.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

SRC_DIR="moodboard"
OUT_DIR="public/moodboard"
MAX_DIM="640x640"
QUALITY="78"

if [[ ! -d "$SRC_DIR" ]]; then
	echo "no $SRC_DIR/ directory found" >&2
	exit 1
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

manifest_entries=()

process_file() {
	local filepath="$1" category="$2" index="$3"
	local mime
	mime=$(file --brief --mime-type "$filepath" 2>/dev/null || echo "")
	case "$mime" in
		image/*) ;;
		*) echo "skip (not an image): $filepath" >&2; return ;;
	esac
	local cat_dir="$OUT_DIR/$category"
	mkdir -p "$cat_dir"
	local out="$cat_dir/$(printf '%02d' "$index").webp"
	if magick "$filepath" -auto-orient -resize "${MAX_DIM}>" -strip -quality "$QUALITY" "$out" 2>/dev/null; then
		manifest_entries+=("{\"src\":\"/moodboard/$category/$(printf '%02d' "$index").webp\",\"category\":\"$category\"}")
		echo "built: $out"
	else
		echo "failed to convert: $filepath" >&2
	fi
}

# Top-level loose files -> "general" category
i=0
while IFS= read -r -d '' f; do
	i=$((i + 1))
	process_file "$f" "general" "$i"
done < <(find "$SRC_DIR" -maxdepth 1 -type f -print0 | sort -z)

# One level of subdirectories -> category = directory name
while IFS= read -r -d '' dir; do
	category=$(basename "$dir")
	i=0
	while IFS= read -r -d '' f; do
		i=$((i + 1))
		process_file "$f" "$category" "$i"
	done < <(find "$dir" -maxdepth 1 -type f -print0 | sort -z)
done < <(find "$SRC_DIR" -mindepth 1 -maxdepth 1 -type d -print0 | sort -z)

{
	printf '[\n'
	for idx in "${!manifest_entries[@]}"; do
		sep=","
		[[ "$idx" -eq $((${#manifest_entries[@]} - 1)) ]] && sep=""
		printf '  %s%s\n' "${manifest_entries[$idx]}" "$sep"
	done
	printf ']\n'
} > "$OUT_DIR/manifest.json"

echo "wrote $OUT_DIR/manifest.json (${#manifest_entries[@]} images)"
