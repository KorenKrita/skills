import { chmodSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  copyFilePreservingMode,
  findNewFileConflicts,
  findOrphanedStateKeys,
  findRemovedFiles,
  isExcludedFile,
  isUpstreamOwned,
  planSparseCheckout,
  planSync,
  syncStateAfterPr,
  syncStateForPrBranch,
  toSparseDir,
  upstreamOwnedNames,
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

  describe("ownership", () => {
    it("treats a missing or explicit upstream ownership as upstream-owned", () => {
      expect(isUpstreamOwned({})).toBe(true)
      expect(isUpstreamOwned({ ownership: "upstream" })).toBe(true)
    })

    it("excludes locally owned skills from upstream sync", () => {
      expect(isUpstreamOwned({ ownership: "local" })).toBe(false)
    })

    it("lists only upstream-owned skills for state reconciliation", () => {
      expect(
        upstreamOwnedNames({
          teach: {},
          "improve-codebase-architecture": { ownership: "local" },
          prototype: { ownership: "upstream" },
        }),
      ).toEqual(["teach", "prototype"])
    })

    it("keeps a locally owned skill from being pruned as an orphaned state key", () => {
      const skills = { teach: {}, "improve-codebase-architecture": { ownership: "local" } }
      // Sync state only ever holds upstream-owned skills, so the local entry
      // must not appear there and must not drag the upstream key out with it.
      expect(findOrphanedStateKeys(["teach"], upstreamOwnedNames(skills))).toEqual([])
      expect(findOrphanedStateKeys(["teach", "grilling"], upstreamOwnedNames(skills))).toEqual([
        "grilling",
      ])
    })

    describe("planSync", () => {
      const skills: Record<string, { ownership?: string; source?: { repo: string } }> = {
        "diagnosing-bugs": { source: { repo: "mattpocock/skills" } },
        "improve-codebase-architecture": { ownership: "local" },
        teach: { source: { repo: "mattpocock/skills" } },
      }

      it("skips locally owned skills and keeps every upstream one", () => {
        const plan = planSync(skills)
        expect(plan.sync.map(([name]) => name)).toEqual(["diagnosing-bugs", "teach"])
        expect(plan.skipped).toEqual(["improve-codebase-architecture"])
      })

      it("hands the sync loop the full upstream config for each synced skill", () => {
        const plan = planSync(skills)
        expect(plan.sync[0]?.[1]).toBe(skills["diagnosing-bugs"])
      })

      it("returns an empty plan for an empty override set", () => {
        expect(planSync({})).toEqual({ sync: [], skipped: [] })
      })
    })
  })

  it("finds sync-state entries with no matching override", () => {
    expect(
      findOrphanedStateKeys(
        ["tdd", "zoom-out", "decision-mapping"],
        ["tdd", "wayfinder"],
      ),
    ).toEqual(["zoom-out", "decision-mapping"])
  })
  it("matches exact-file and directory exclusion rules", () => {
    expect(isExcludedFile("README.md", ["README.md"])).toBe(true)
    expect(isExcludedFile("references/README.md", ["README.md"])).toBe(false)
    expect(isExcludedFile("test/new-upstream.test.mjs", ["test/"])).toBe(true)
    expect(isExcludedFile("testing/example.mjs", ["test/"])).toBe(false)
  })

  it("does not exclude files when no rule matches", () => {
    expect(isExcludedFile("SKILL.md", ["test/", "README.md"])).toBe(false)
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

  describe("sync state lifecycle", () => {
    const accepted = { sha: "old", files: ["SKILL.md", "CONTEXT-FORMAT.md"] }
    const candidate = { sha: "new", files: ["SKILL.md", "GLOSSARY-FORMAT.md"] }

    it("keeps main on the accepted manifest while a sync PR is unmerged", () => {
      // Advancing main before merge made the next run forget CONTEXT-FORMAT.md was upstream-managed.
      for (const result of ["created", "branch-exists"] as const) {
        const state = { "domain-modeling": accepted }
        const next = syncStateAfterPr(state, "domain-modeling", candidate, result)
        expect(next).toEqual({ "domain-modeling": accepted })
        expect(findRemovedFiles(next["domain-modeling"]!.files!, candidate.files)).toEqual(["CONTEXT-FORMAT.md"])
      }
    })

    it("advances main only when upstream produced no content change", () => {
      const next = syncStateAfterPr({ "domain-modeling": accepted }, "domain-modeling", candidate, "no-changes")
      expect(next).toEqual({ "domain-modeling": candidate })
    })

    it("ships the candidate manifest inside the sync PR so merge accepts files and state together", () => {
      const main = { "domain-modeling": accepted, tdd: { sha: "t", files: ["SKILL.md"] } }
      expect(syncStateForPrBranch(main, "domain-modeling", candidate)).toEqual({
        "domain-modeling": candidate,
        tdd: { sha: "t", files: ["SKILL.md"] },
      })
      expect(main["domain-modeling"]).toBe(accepted)
    })
  })
})
