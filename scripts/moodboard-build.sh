#!/usr/bin/env bash
# Rebuilds public/moodboard/ from the moodboard/ source directory.
#
# moodboard/ (repo root, gitignored, not web-servable) is the canonical,
# human-curated image source. Any file directly inside moodboard/ is
# "general" category; any file inside a moodboard/<name>/ subdirectory is
# categorized under <name> (e.g. moodboard/lil-peep/*.png -> category
# "lil-peep"). Subdirectories are not recursed further.
#
# Output: public/moodboard/<category-or-general>/<content-hash>.webp
# (optimized, resized, committed to git) + public/moodboard/manifest.json
# (ordered list of { src, category } consumed by the autoscroll strip on
# /music). Filenames are a hash of the SOURCE file's bytes, not a sequence
# position — this matters because Cloudflare's default image cache-control
# is ~4h: with positional filenames (01.webp, 02.webp...), inserting any
# file earlier in sort order shifts every later file onto a URL that used
# to mean different content, and browsers serve stale bytes under that
# reused URL until the cache expires. Content-addressed filenames mean a
# given URL's bytes never change, so caching (however aggressive) can never
# go stale — a genuinely new/changed image always gets a new URL.
#
# Safe to re-run anytime after adding/removing files in moodboard/.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

SRC_DIR="moodboard"
OUT_DIR="public/moodboard"
MAX_DIM="640x640"
QUALITY="78"
MAX_BYTES=300000
FALLBACK_DIM="480x480"
FALLBACK_QUALITY="65"
TARGET_FRAMES=24

if [[ ! -d "$SRC_DIR" ]]; then
	echo "no $SRC_DIR/ directory found" >&2
	exit 1
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

manifest_entries=()

process_file() {
	local filepath="$1" category="$2"
	local mime
	mime=$(file --brief --mime-type "$filepath" 2>/dev/null || echo "")
	case "$mime" in
		image/*) ;;
		*) echo "skip (not an image): $filepath" >&2; return ;;
	esac
	local cat_dir="$OUT_DIR/$category"
	mkdir -p "$cat_dir"
	local hash
	hash=$(sha256sum "$filepath" | cut -c1-16)
	local out="$cat_dir/$hash.webp"
	if [[ -f "$out" ]]; then
		manifest_entries+=("{\"src\":\"/moodboard/$category/$hash.webp\",\"category\":\"$category\"}")
		echo "exists (same content elsewhere): $out"
		return
	fi
	if ! magick "$filepath" -auto-orient -resize "${MAX_DIM}>" -strip -quality "$QUALITY" "$out" 2>/dev/null; then
		echo "failed to convert: $filepath" >&2
		return
	fi
	local size
	size=$(stat -c%s "$out" 2>/dev/null || echo 0)
	if [[ "$size" -gt "$MAX_BYTES" ]]; then
		# Outlier (commonly: a multi-frame animated GIF, where every frame is
		# full-resolution real content, not just a big photo). Re-encode at a
		# smaller size and, if animated, drop to ~TARGET_FRAMES frames with
		# proportionally longer per-frame delay so real-time pacing is kept.
		local nframes
		nframes=$(magick identify "$filepath" 2>/dev/null | wc -l)
		if [[ "$nframes" -gt "$TARGET_FRAMES" ]]; then
			local stride=$(( (nframes + TARGET_FRAMES - 1) / TARGET_FRAMES ))
			local delay
			delay=$(magick identify -format "%T" "${filepath}[0]" 2>/dev/null || echo 10)
			local idx
			idx=$(seq 0 "$stride" $((nframes - 1)) | paste -sd, -)
			magick "${filepath}[${idx}]" -auto-orient -resize "${FALLBACK_DIM}>" -strip \
				-quality "$FALLBACK_QUALITY" -delay $((delay * stride)) -loop 0 "$out" 2>/dev/null \
				|| echo "fallback re-encode failed, keeping oversized output: $filepath" >&2
		else
			magick "$filepath" -auto-orient -resize "${FALLBACK_DIM}>" -strip \
				-quality "$FALLBACK_QUALITY" "$out" 2>/dev/null \
				|| echo "fallback re-encode failed, keeping oversized output: $filepath" >&2
		fi
		echo "shrunk outlier ($size -> $(stat -c%s "$out" 2>/dev/null || echo "?") bytes): $out"
	fi
	manifest_entries+=("{\"src\":\"/moodboard/$category/$hash.webp\",\"category\":\"$category\"}")
	echo "built: $out"
}

# Top-level loose files -> "general" category
while IFS= read -r -d '' f; do
	process_file "$f" "general"
done < <(find "$SRC_DIR" -maxdepth 1 -type f -print0 | sort -z)

# One level of subdirectories -> category = directory name
while IFS= read -r -d '' dir; do
	category=$(basename "$dir")
	while IFS= read -r -d '' f; do
		process_file "$f" "$category"
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
