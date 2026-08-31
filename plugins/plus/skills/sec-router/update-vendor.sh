#!/usr/bin/env bash
# Re-vendor the reverse-skill upstream tree into ./vendor/
# Usage: cd plugins/plus/skills/sec-router && ./update-vendor.sh
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
VENDOR="$SKILL_DIR/vendor"
UPSTREAM_REPO="https://github.com/zhaoxuya520/reverse-skill"
TMP="$(mktemp -d)/reverse-skill"

echo "Cloning upstream..."
git clone --depth 1 "$UPSTREAM_REPO" "$TMP"
COMMIT="$(git -C "$TMP" rev-parse HEAD)"
DATE="$(date +%F)"
echo "Upstream commit: $COMMIT ($DATE)"

echo "Syncing into vendor/ (rename SKILL.md -> MOD.md)..."
rsync -a --delete \
  --exclude='.git' --exclude='.github' --exclude='reverse-skill.png' --exclude='.DS_Store' \
  "$TMP/" "$VENDOR/"

find "$VENDOR" -name 'SKILL.md' -exec sh -c 'mv "$1" "$(dirname "$1")/MOD.md"' _ {} \;
grep -rl 'SKILL\.md' "$VENDOR" | while read -r f; do
  sed -i '' 's/SKILL\.md/MOD.md/g' "$f"
done

LEFT="$(find "$VENDOR" -name 'SKILL.md' | wc -l | tr -d ' ')"
if [ "$LEFT" != "0" ]; then
  echo "ERROR: $LEFT SKILL.md files remain" >&2
  exit 1
fi

echo "Done. Update VENDOR.md with:"
echo "  Commit: $COMMIT"
echo "  Vendored at: $DATE"
echo "Remember to copy out any case work / journal entries first (they were replaced)."
