# Project Agent Rules

## Plugin versioning

- `marketplace.yaml` is the single source of truth for the `base`, `plus`, and `creative` plugin versions.
- Every change that alters a published plugin's files or behavior must increment that plugin's patch version by exactly `0.0.1` in the same PR or commit.
- Changes under `plugins/base/`, `plugins/plus/`, or `plugins/creative/` increment the matching plugin version. A change affecting multiple plugins increments each affected version.
- Changes to shared publishing or sync logic increment every plugin whose distributed behavior changes. When the affected set is unclear, increment all three plugins.
- After changing a version, run `npm run build:marketplace` and commit both `marketplace.yaml` and `.claude-plugin/marketplace.json`.
- Never edit `.claude-plugin/marketplace.json` by hand.
- Upstream sync automation performs the version increment automatically when it creates a PR with actual Skill changes. Do not add a second manual increment to the same sync PR.
- OMP and Claude Code use the generated marketplace plugin versions to detect updates, so published plugin changes without a matching version increment are incomplete.
