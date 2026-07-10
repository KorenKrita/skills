import { describe, expect, it } from "vitest"
import {
  findNewFileConflicts,
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
