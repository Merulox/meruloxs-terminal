#!/usr/bin/env bash
# Automatic moodboard refresh — runs on a short systemd timer (see
# systemd.user.services.meruloxs-moodboard-build in /etc/nixos/home.nix).
#
# Cheaply hashes the moodboard/ source tree (paths + sizes + mtimes, not file
# content — fast, no need to read every image) and only rebuilds
# public/moodboard/ (via moodboard-build.sh, which does `rm -rf` + rebuild,
# so removed source files disappear from the output too — not just additions)
# when something actually changed. On a successful rebuild: commits + pushes
# just the public/moodboard/ paths, builds the full site, and redeploys the
# preview-moodboard Pages branch so the LIVE preview mirrors moodboard/
# exactly (including deletions) without a human re-running anything.
# Never touches production (merulox.com) — that stays an explicit decision.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/meruloxs-moodboard-build"
HASH_FILE="$STATE_DIR/source.sha256"
mkdir -p "$STATE_DIR"

if [[ ! -d moodboard ]]; then
	echo "no moodboard/ directory, nothing to do"
	exit 0
fi

current_hash=$(find moodboard -type f -printf '%p %s %T@\n' 2>/dev/null | sort | sha256sum | cut -d' ' -f1)
previous_hash=""
[[ -f "$HASH_FILE" ]] && previous_hash=$(cat "$HASH_FILE")

if [[ "$current_hash" == "$previous_hash" ]]; then
	exit 0
fi

echo "moodboard/ changed, rebuilding..."
./scripts/moodboard-build.sh

echo "$current_hash" > "$HASH_FILE"

if ! git diff --quiet -- public/moodboard/ || ! git diff --cached --quiet -- public/moodboard/ 2>/dev/null; then
	git add public/moodboard/
	if ! git diff --cached --quiet -- public/moodboard/; then
		count=$(find public/moodboard -name '*.webp' | wc -l)
		git commit -m "chore(moodboard): auto-refresh (${count} images)

Automatic rebuild triggered by a change under moodboard/ (source dir,
gitignored). See scripts/moodboard-auto-refresh.sh."
		git push origin main
		echo "committed and pushed moodboard refresh"
	fi
else
	echo "rebuild produced no public/moodboard/ diff"
fi

echo "building site for redeploy..."
npm run build >/tmp/moodboard-auto-refresh-build.log 2>&1

echo "redeploying preview-moodboard (mirrors moodboard/ exactly, including deletions)..."
npx --yes wrangler@4 pages deploy dist --project-name merulox --branch preview-moodboard --commit-dirty=true >/tmp/moodboard-auto-refresh-deploy.log 2>&1
echo "redeployed: https://preview-moodboard.merulox.pages.dev/music/"
