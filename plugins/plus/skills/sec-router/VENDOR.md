# Vendor provenance: reverse-skill

| Field | Value |
|---|---|
| Upstream | https://github.com/zhaoxuya520/reverse-skill |
| Commit | `71acc8e3115f76bad7a914c36466c1086232288c` |
| Vendored at | 2026-08-31 |
| License | MIT (see `vendor/LICENSE`) |
| Size | ~7.6 MB working tree |

## Deviations from upstream

1. **`SKILL.md` → `MOD.md` rename.** Every upstream `SKILL.md` (87 files) was
   renamed to `MOD.md`, and all textual references inside the vendored tree
   were rewritten accordingly. Reason: Pi discovers nested `SKILL.md` files
   recursively as skills; without the rename, 87 upstream skills would load
   into the skill registry and pollute trigger matching. The routing entry for
   this payload is the top-level `SKILL.md` in this directory only.
2. **Excluded from the copy**: `.git/`, `.github/`, `reverse-skill.png`
   (1.6 MB banner), `.DS_Store`.

Everything else is a verbatim copy. Runtime artifacts (`work/`, tool-index,
field-journal additions) are gitignored — see `.gitignore` beside this file and
the upstream `vendor/.gitignore`.

## Updating

Run `./update-vendor.sh` from this directory. It clones upstream `main`,
re-applies the rename, and prints the new commit hash — paste it into the table
above and commit. Before updating, copy anything worth keeping out of
`vendor/` (case reports under `vendor/work/`, journal entries under
`vendor/skills/field-journal/`); the sync replaces the whole tree.
