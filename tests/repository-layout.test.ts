import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { parse as parseYaml } from "yaml"
import { isExcludedFile, isUpstreamOwned, upstreamOwnedNames } from "../scripts/sync-utils.js"

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "")
const PLUGINS = ["base", "plus"] as const

const EXPECTED_SKILLS = {
  base: [
    "ask-matt",
    "code-review",
    "codebase-design",
    "diagnosing-bugs",
    "domain-modeling",
    "grill-me",
    "grill-with-docs",
    "grilling",
    "handoff",
    "implement",
    "implement-spec",
    "improve-codebase-architecture",
    "pr",
    "prototype",
    "research",
    "retro",
    "setup-matt-pocock-skills",
    "tdd",
    "teach",
    "to-questionnaire",
    "to-spec",
    "to-tickets",
    "triage",
    "wait-what",
    "wayfinder",
    "wizard",
    "writing-for-agents",
  ],
  plus: ["award-tier-web-design", "i-have-adhd", "razor", "sec-router"],
} as const

const EXPECTED_SKILL_COUNT = Object.values(EXPECTED_SKILLS).flat().length

/** Skills this repository maintains itself, excluded from upstream sync. */
const LOCAL_SKILLS = ["sec-router"] as const
const LOCAL_PROVENANCE_REPOS: Record<string, string> = { "sec-router": "zhaoxuya520/reverse-skill" }

/** base Skills removed from the subscription; nothing may still route to them. */
const REMOVED_BASE_SKILLS = ["resolving-merge-conflicts"] as const

function readOverrides(): {
  skills: Record<
    string,
    {
      plugin: string
      ownership?: string
      provenance?: Record<string, string>
      exclude_files?: string[]
      patches?: Array<{
        type: string
        field?: string
        value?: string | boolean | number
        pattern?: string
        with?: string
      }>
      target_patches?: Array<{ target: string }>
    }
  >
} {
  return parseYaml(readFileSync(join(ROOT, "overrides.yaml"), "utf-8"))
}

function skillNames(plugin: string): string[] {
  return readdirSync(join(ROOT, "plugins", plugin, "skills"))
    .filter((name) => statSync(join(ROOT, "plugins", plugin, "skills", name)).isDirectory())
    .sort()
}

function frontmatterName(path: string): string | undefined {
  return readFileSync(path, "utf-8").match(/^name:\s*(.+)$/m)?.[1]?.trim()
}

function textFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return textFiles(path)
    return /\.(md|ya?ml|json)$/.test(entry.name) ? [path] : []
  })
}
function relativeFiles(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) return relativeFiles(join(dir, entry.name), relativePath)
    return [relativePath]
  })
}

describe("repository layout", () => {
  it("publishes exactly base and plus", () => {
    const actual = readdirSync(join(ROOT, "plugins"))
      .filter((name) => statSync(join(ROOT, "plugins", name)).isDirectory())
      .sort()
    expect(actual).toEqual([...PLUGINS].sort())
  })

  it("keeps marketplace versions valid and generated entries aligned", () => {
    const config = parseYaml(readFileSync(join(ROOT, "marketplace.yaml"), "utf-8")) as {
      plugins: Record<string, { version: string }>
    }
    const generated = JSON.parse(
      readFileSync(join(ROOT, ".claude-plugin", "marketplace.json"), "utf-8"),
    ) as { plugins: Array<{ name: string; version?: string }> }

    expect(Object.keys(config.plugins).sort()).toEqual([...PLUGINS].sort())
    expect(generated.plugins.map(({ name }) => name).sort()).toEqual([...PLUGINS].sort())

    for (const plugin of PLUGINS) {
      const version = config.plugins[plugin]?.version
      expect(version, plugin).toMatch(/^\d+\.\d+\.\d+$/)
      expect(generated.plugins.find((entry) => entry.name === plugin)?.version, plugin).toBe(version)
    }
  })

  it(`contains the approved ${EXPECTED_SKILL_COUNT} unique skills`, () => {
    const allNames = PLUGINS.flatMap((plugin) => skillNames(plugin))
    expect(skillNames("base")).toEqual([...EXPECTED_SKILLS.base].sort())
    expect(skillNames("plus")).toEqual([...EXPECTED_SKILLS.plus].sort())
    expect(allNames).toHaveLength(EXPECTED_SKILL_COUNT)
    expect(new Set(allNames).size).toBe(EXPECTED_SKILL_COUNT)
  })

  it("keeps every skill directory aligned with its frontmatter name", () => {
    for (const plugin of PLUGINS) {
      for (const skill of skillNames(plugin)) {
        const skillFile = join(ROOT, "plugins", plugin, "skills", skill, "SKILL.md")
        expect(existsSync(skillFile), skillFile).toBe(true)
        expect(frontmatterName(skillFile), skillFile).toBe(skill)
      }
    }
  })

  it("keeps sync state aligned with every upstream-managed skill", () => {
    const overrides = readOverrides()
    const state = JSON.parse(readFileSync(join(ROOT, ".sync-state.json"), "utf-8")) as Record<string, unknown>
    expect(Object.keys(state).sort()).toEqual(upstreamOwnedNames(overrides.skills).sort())
    expect(Object.keys(overrides.skills)).toHaveLength(EXPECTED_SKILL_COUNT)
    for (const [skill, config] of Object.entries(overrides.skills)) {
      expect(existsSync(join(ROOT, "plugins", config.plugin, "skills", skill)), skill).toBe(true)
    }
  })

  it("keeps locally owned skills out of upstream sync but inside the inventory", () => {
    const overrides = readOverrides()
    const state = JSON.parse(readFileSync(join(ROOT, ".sync-state.json"), "utf-8")) as Record<string, unknown>

    for (const skill of LOCAL_SKILLS) {
      const entry = overrides.skills[skill]
      expect(entry, skill).toBeDefined()
      expect(entry?.ownership, skill).toBe("local")
      expect(isUpstreamOwned(entry!), skill).toBe(false)
      // No upstream source means the sync loop can never fetch or overwrite it.
      expect("source" in entry!, skill).toBe(false)
      expect(state[skill], skill).toBeUndefined()
      // Provenance keeps the fork origin and its license auditable.
      expect(entry?.provenance?.repo, skill).toBe(LOCAL_PROVENANCE_REPOS[skill])
      expect(entry?.provenance?.forked_at_sha, skill).toMatch(/^[0-9a-f]{40}$/)
      expect(entry?.provenance?.license, skill).toBeTruthy()
      expect(existsSync(join(ROOT, "plugins", entry!.plugin, "skills", skill)), skill).toBe(true)
    }

    const upstreamNames = upstreamOwnedNames(overrides.skills)
    for (const skill of LOCAL_SKILLS) expect(upstreamNames).not.toContain(skill)
  })

  it("routes to no removed base skill from any surviving runtime file", () => {
    const runtime = textFiles(join(ROOT, "plugins", "base"))
      .map((path) => `${path}\n${readFileSync(path, "utf-8")}`)
      .join("\n")
    for (const skill of REMOVED_BASE_SKILLS) {
      expect(existsSync(join(ROOT, "plugins", "base", "skills", skill)), skill).toBe(false)
      expect(runtime, skill).not.toContain(`/${skill}`)
    }
  })

  it("does not publish files excluded by sync rules", () => {
    const overrides = readOverrides()
    const state = JSON.parse(readFileSync(join(ROOT, ".sync-state.json"), "utf-8")) as Record<
      string,
      { files?: string[] }
    >

    for (const [skill, config] of Object.entries(overrides.skills)) {
      const patchTargets = config.target_patches?.map(({ target }) => target) ?? []
      const skillRoot = join(ROOT, "plugins", config.plugin, "skills", skill)
      const publishedFiles = relativeFiles(skillRoot)
      for (const excludedFile of config.exclude_files ?? []) {
        expect(
          publishedFiles.filter((file) => isExcludedFile(file, [excludedFile])),
          `${skill} payload: ${excludedFile}`,
        ).toEqual([])
        expect(
          (state[skill]?.files ?? []).filter((file) => isExcludedFile(file, [excludedFile])),
          `${skill} sync state: ${excludedFile}`,
        ).toEqual([])
        expect(
          patchTargets.filter((target) => isExcludedFile(target, [excludedFile])),
          `${skill} patch target: ${excludedFile}`,
        ).toEqual([])
      }
    }
  })



  it("removes unavailable hai skill references from the selected subset", () => {
    const selected = ["razor"]
    const content = selected
      .flatMap((skill) => textFiles(join(ROOT, "plugins", "plus", "skills", skill)))
      .map((path) => readFileSync(path, "utf-8"))
      .join("\n")
    expect(content).not.toMatch(/\b(?:hai-goal|hai-prd|hai-naming|hai-architecture|hai-tdd|hai-rewrite-doc|entity-model-auditor|hai-audit-docs-internally|hai-audit-docs-against-code|hai-idea|hai-visual-report)\b/)
    expect(content).not.toContain("SKILL.zh_CN.md")
  })

  it("keeps removed cross-skill routes suppressed", () => {
    const overrides = readOverrides()
    const checks = [
      { skill: "razor", path: join("plugins", "plus", "skills", "razor", "SKILL.md"), marker: "use `hai-idea`" },
    ]

    for (const { skill, path, marker } of checks) {
      expect(readFileSync(join(ROOT, path), "utf-8"), path).not.toContain(marker)
      expect(
        overrides.skills[skill]?.patches?.some(
          (patch) => patch.type === "replace" && patch.pattern?.includes(marker) && patch.with === "",
        ),
        `${skill} removal patch for ${marker}`,
      ).toBe(true)
    }
  })

  it("keeps i-have-adhd model-invocable across upstream sync", () => {
    const entry = readOverrides().skills["i-have-adhd"]
    const skill = readFileSync(
      join(ROOT, "plugins", "plus", "skills", "i-have-adhd", "SKILL.md"),
      "utf-8",
    )
    const patches = entry?.patches ?? []

    expect(skill).not.toContain("disable-model-invocation:")
    expect(skill).not.toContain("Invoke with /i-have-adhd")
    expect(skill).toContain("Use when the user says they have ADHD")
    expect(
      patches.some(
        (patch) =>
          patch.type === "remove_frontmatter" && patch.field === "disable-model-invocation",
      ),
    ).toBe(true)
    expect(
      patches.some((patch) => patch.type === "set_frontmatter" && patch.field === "description"),
    ).toBe(true)
  })

  it("does not publish or resync the removed pua Skill", () => {
    const overrides = readOverrides()
    const state = JSON.parse(readFileSync(join(ROOT, ".sync-state.json"), "utf-8")) as Record<
      string,
      unknown
    >

    expect(overrides.skills.pua).toBeUndefined()
    expect(state.pua).toBeUndefined()
    expect(existsSync(join(ROOT, "plugins", "plus", "skills", "pua"))).toBe(false)
  })

  it("keeps only the approved plugin-level assets", () => {
    expect(existsSync(join(ROOT, "plugins", "plus", "hooks"))).toBe(false)
    expect(existsSync(join(ROOT, "plugins", "plus", "agents"))).toBe(false)
    expect(existsSync(join(ROOT, "plugins", "base", "rules"))).toBe(false)
    expect(existsSync(join(ROOT, "plugins", "plus", "rules"))).toBe(false)
  })
})
