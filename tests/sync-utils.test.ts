import { chmodSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  copyFilePreservingMode,
  findNewFileConflicts,
  findOrphanedStateKeys,
  findRemovedFiles,
  planSparseCheckout,
  toSparseDir,
} from "../scripts/sync-utils.js"

describe("sync-utils", () => {
  describe("toSparseDir", () => {
    it("keeps repository root as root", () => {
      expect(toSparseDir(".")).toBe(".")
    })

    it("keeps directories and converts file mappings to their parent", () => {
      expect(toSparseDir("skills/write")).toBe("skills/write")
      expect(toSparseDir("hooks/hooks.json")).toBe("hooks")
    })
  })

  describe("planSparseCheckout", () => {
    it("disables sparse checkout when any mapping needs the whole repository", () => {
      expect(planSparseCheckout([".", "hooks/hooks.json"])).toEqual({
        checkoutWholeRepo: true,
        directories: [],
      })
    })

    it("deduplicates sparse directories", () => {
      expect(planSparseCheckout(["hooks/hooks.json", "hooks/run-hook.cmd"])).toEqual({
        checkoutWholeRepo: false,
        directories: ["hooks"],
      })
    })
  })

  it("copies executable mode together with file content", () => {
    const dir = mkdtempSync(join(tmpdir(), "skills-sync-utils-"))
    try {
      const src = join(dir, "src.sh")
      const dest = join(dir, "nested", "dest.sh")
      writeFileSync(src, "#!/bin/sh\necho ok\n")
      chmodSync(src, 0o755)

      copyFilePreservingMode(src, dest)

      expect(statSync(dest).mode & 0o777).toBe(0o755)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("finds sync-state entries with no matching override", () => {
    expect(
      findOrphanedStateKeys(
        ["tdd", "zoom-out", "decision-mapping"],
        ["tdd", "wayfinder"],
      ),
    ).toEqual(["zoom-out", "decision-mapping"])
  })

  it("finds files removed by upstream", () => {
    expect(findRemovedFiles(["SKILL.md", "old.md"], ["SKILL.md", "new.md"])).toEqual([
      "old.md",
    ])
  })

  it("only reports a conflict for a newly upstream-managed local file", () => {
    expect(
      findNewFileConflicts(
        ["SKILL.md", "local.md", "new-upstream.md"],
        ["SKILL.md"],
        ["SKILL.md", "new-upstream.md"],
      ),
    ).toEqual(["new-upstream.md"])
  })

  it("does not invent conflicts before a manifest has been recorded", () => {
    expect(findNewFileConflicts(["SKILL.md"], undefined, ["SKILL.md"])).toEqual([])
  })
})
