#!/usr/bin/env bash
# Automatic static-asset refresh for the gitignored moodboard/ and audio/
# source directories. A systemd path unit starts this script immediately on
# change; the existing timer remains as a retry fallback.
#
# Builds happen in a detached worktree based on origin/main. Only generated
# public/moodboard/ and public/audio/ paths are committed, pushed, built, and
# deployed. The mutable checkout and unrelated edits are never staged or
# published.
set -euo pipefail

REPO_ROOT="${MERULOX_ASSET_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
STATE_DIR="${MERULOX_ASSET_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/meruloxs-moodboard-build}"
STABILITY_WAIT_SECONDS="${MERULOX_ASSET_STABILITY_WAIT_SECONDS:-3}"
DRY_RUN="${MERULOX_ASSET_AUTODEPLOY_DRY_RUN:-0}"
MAX_PUSH_ATTEMPTS="${MERULOX_ASSET_MAX_PUSH_ATTEMPTS:-3}"
PROJECT_NAME="${MERULOX_PAGES_PROJECT:-merulox}"
PRODUCTION_URL="${MERULOX_PRODUCTION_URL:-https://merulox.com}"

mkdir -p "$STATE_DIR"
exec 9>"$STATE_DIR/refresh.lock"
if ! flock -n 9; then
	echo "static asset refresh already running; coalescing this trigger"
	exit 0
fi

audio_hash() {
	local root=$1
	[[ -d "$root/audio" ]] || return 1
	(
		cd "$root"
		while IFS= read -r -d '' source_file; do
			printf '%s\0' "$source_file"
			sha256sum "$source_file"
		done < <(find audio -type f -print0 | sort -z)
		printf 'builder\0'
		sha256sum scripts/bgm-build.sh
		printf 'loudness_i=%s\0' "${BGM_LOUDNESS_I:--16}"
		printf 'loudness_tp=%s\0' "${BGM_LOUDNESS_TP:--1.5}"
		printf 'loudness_lra=%s\0' "${BGM_LOUDNESS_LRA:-11}"
	) | sha256sum | cut -d' ' -f1
}

moodboard_hash() {
	local root=$1
	[[ -d "$root/moodboard" ]] || return 1
	(
		cd "$root"
		find moodboard -type f -printf '%p %s %T@\n' 2>/dev/null | sort
		printf 'builder\0'
		sha256sum scripts/moodboard-build.sh
	) | sha256sum | cut -d' ' -f1
}

read_state() {
	local state_file=$1
	if [[ -f "$state_file" ]]; then
		cat "$state_file"
	fi
	return 0
}

write_state() {
	local state_file=$1
	local value=$2
	local temporary="${state_file}.tmp.$$"
	printf '%s\n' "$value" > "$temporary"
	mv "$temporary" "$state_file"
}

if [[ ! -d "$REPO_ROOT/audio" || ! -d "$REPO_ROOT/moodboard" ]]; then
	echo "audio/ and moodboard/ must both exist under $REPO_ROOT" >&2
	exit 1
fi

audio_state_file="$STATE_DIR/audio-source.sha256"
moodboard_state_file="$STATE_DIR/moodboard-source.sha256"

current_audio_hash=$(audio_hash "$REPO_ROOT")
current_moodboard_hash=$(moodboard_hash "$REPO_ROOT")
previous_audio_hash=$(read_state "$audio_state_file")
# The legacy refresher wrote source.sha256 before push/deploy. Do not treat it
# as a publication receipt; the first generalized run verifies moodboard once.
previous_moodboard_hash=$(read_state "$moodboard_state_file")

audio_changed=0
moodboard_changed=0
[[ "$current_audio_hash" != "$previous_audio_hash" ]] && audio_changed=1
[[ "$current_moodboard_hash" != "$previous_moodboard_hash" ]] && moodboard_changed=1

if (( ! audio_changed && ! moodboard_changed )); then
	exit 0
fi

if [[ "$STABILITY_WAIT_SECONDS" != "0" ]]; then
	sleep "$STABILITY_WAIT_SECONDS"
fi
stable_audio_hash=$(audio_hash "$REPO_ROOT")
stable_moodboard_hash=$(moodboard_hash "$REPO_ROOT")
if [[ "$stable_audio_hash" != "$current_audio_hash" || "$stable_moodboard_hash" != "$current_moodboard_hash" ]]; then
	echo "asset source changed during the stability window; deferring to the next trigger"
	exit 0
fi

# A change can settle back to the already-published state during the debounce.
audio_changed=0
moodboard_changed=0
[[ "$stable_audio_hash" != "$previous_audio_hash" ]] && audio_changed=1
[[ "$stable_moodboard_hash" != "$previous_moodboard_hash" ]] && moodboard_changed=1
if (( ! audio_changed && ! moodboard_changed )); then
	exit 0
fi

changed_labels=()
(( audio_changed )) && changed_labels+=("audio")
(( moodboard_changed )) && changed_labels+=("moodboard")
changed_text=$(IFS=+; printf '%s' "${changed_labels[*]}")
echo "${changed_text} source changed; building from a clean origin/main worktree"

worktree=""
cleanup_worktree() {
	if [[ -n "$worktree" ]]; then
		git -C "$REPO_ROOT" worktree remove --force "$worktree" >/dev/null 2>&1 || rm -rf "$worktree"
		worktree=""
		git -C "$REPO_ROOT" worktree prune >/dev/null 2>&1 || true
	fi
}
trap cleanup_worktree EXIT

prepare_dependencies() {
	# Install exactly the lockfile associated with origin/main. Sharing the
	# mutable checkout's node_modules would break worktree reproducibility.
	(cd "$worktree" && npm ci)
}

verify_live_manifest() {
	local name=$1
	local expected_file=$2
	local commit=$3
	local live_file="$STATE_DIR/live-${name}.json"
	local attempt
	for attempt in {1..12}; do
		if curl --fail --silent --show-error \
			"$PRODUCTION_URL/$name/manifest.json?deploy=$commit" -o "$live_file" &&
			cmp -s "$expected_file" "$live_file"; then
			rm -f "$live_file"
			return 0
		fi
		sleep 5
	done
	echo "live $name manifest did not match commit $commit" >&2
	return 1
}

deploy_commit() {
	local commit=$1
	local message=$2
	(cd "$worktree" && npm run build)
	if (( moodboard_changed )); then
		(
			cd "$worktree"
			npx --yes wrangler@4 pages deploy dist \
				--project-name "$PROJECT_NAME" \
				--branch preview-moodboard \
				--commit-hash "$commit" \
				--commit-message "$message"
		)
	fi
	(
		cd "$worktree"
		npx --yes wrangler@4 pages deploy dist \
			--project-name "$PROJECT_NAME" \
			--branch main \
			--commit-hash "$commit" \
			--commit-message "$message"
	)
	curl --fail --silent --show-error "$PRODUCTION_URL/" >/dev/null
	curl --fail --silent --show-error "$PRODUCTION_URL/music/" >/dev/null
	(( audio_changed )) && verify_live_manifest "audio" "$worktree/public/audio/manifest.json" "$commit"
	(( moodboard_changed )) && verify_live_manifest "moodboard" "$worktree/public/moodboard/manifest.json" "$commit"
	return 0
}

for (( attempt = 1; attempt <= MAX_PUSH_ATTEMPTS; attempt++ )); do
	git -C "$REPO_ROOT" fetch --quiet origin main
	base_commit=$(git -C "$REPO_ROOT" rev-parse origin/main)
	worktree="$STATE_DIR/worktree-${base_commit:0:12}-$$-$attempt"
	rm -rf "$worktree"
	git -C "$REPO_ROOT" worktree add --quiet --detach "$worktree" "$base_commit"

	if (( audio_changed )); then
		mkdir -p "$worktree/audio"
		rsync -a --delete "$REPO_ROOT/audio/" "$worktree/audio/"
		(cd "$worktree" && ./scripts/bgm-build.sh)
	fi
	if (( moodboard_changed )); then
		mkdir -p "$worktree/moodboard"
		rsync -a --delete "$REPO_ROOT/moodboard/" "$worktree/moodboard/"
		(cd "$worktree" && ./scripts/moodboard-build.sh)
	fi

	# Refuse to publish a mixed snapshot if source bytes changed during copying
	# or conversion. The path/timer trigger will retry the settled source.
	if (( audio_changed )) && [[ "$(audio_hash "$REPO_ROOT")" != "$stable_audio_hash" ||
		"$(audio_hash "$worktree")" != "$stable_audio_hash" ]]; then
		echo "audio source changed during build; deferring" >&2
		exit 0
	fi
	if (( moodboard_changed )) && [[ "$(moodboard_hash "$REPO_ROOT")" != "$stable_moodboard_hash" ||
		"$(moodboard_hash "$worktree")" != "$stable_moodboard_hash" ]]; then
		echo "moodboard source changed during build; deferring" >&2
		exit 0
	fi

	(( audio_changed )) && git -C "$worktree" add -- public/audio/
	(( moodboard_changed )) && git -C "$worktree" add -- public/moodboard/
	prepare_dependencies

	if [[ "$DRY_RUN" == "1" ]]; then
		(cd "$worktree" && npm run build)
		git -C "$worktree" diff --cached --stat -- public/audio/ public/moodboard/
		echo "dry run complete; no commit, push, deployment, or state update performed"
		exit 0
	fi

	message="chore(assets): auto-refresh ${changed_text}"
	candidate_commit="$base_commit"
	if ! git -C "$worktree" diff --cached --quiet -- public/audio/ public/moodboard/; then
		git -C "$worktree" \
			-c user.name="merulox asset automation" \
			-c user.email="merulox@users.noreply.github.com" \
			commit --quiet -m "$message" -- public/audio/ public/moodboard/
		candidate_commit=$(git -C "$worktree" rev-parse HEAD)

		git -C "$REPO_ROOT" fetch --quiet origin main
		if [[ "$(git -C "$REPO_ROOT" rev-parse origin/main)" != "$base_commit" ]]; then
			echo "origin/main moved during build; retrying from the new tip"
			cleanup_worktree
			continue
		fi
		if ! git -C "$worktree" push --quiet origin HEAD:refs/heads/main; then
			echo "fast-forward push raced; retrying from origin/main" >&2
			cleanup_worktree
			continue
		fi
		echo "pushed generated ${changed_text} assets at ${candidate_commit:0:12}"
	else
		echo "generated assets already match origin/main; retrying deployment receipt"
	fi

	deploy_commit "$candidate_commit" "$message"
	(( audio_changed )) && write_state "$audio_state_file" "$stable_audio_hash"
	(( moodboard_changed )) && write_state "$moodboard_state_file" "$stable_moodboard_hash"
	echo "static asset refresh complete at ${candidate_commit:0:12}"
	exit 0
done

echo "origin/main changed during all $MAX_PUSH_ATTEMPTS push attempts" >&2
exit 1
