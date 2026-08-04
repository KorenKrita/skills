import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { parse as parseYaml } from "yaml"
import { isExcludedFile, isUpstreamOwned, upstreamOwnedNames } from "../scripts/sync-utils.js"

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "")
const PLUGINS = ["base", "plus"] as const

const EXPECTED_SKILLS = {
  base: [
    "diagnosing-bugs",
    "grill-me",
    "handoff",
    "improve-codebase-architecture",
    "prototype",
    "teach",
    "writing-great-skills",
  ],
  plus: [
    "archify",
    "humanizer-zh",
    "i-have-adhd",
    "improve",
    "pua",
    "nuclear-review",
    "razor",
    "read",
  ],
} as const

const EXPECTED_SKILL_COUNT = Object.values(EXPECTED_SKILLS).flat().length

/** Skills this repository maintains itself, excluded from upstream sync. */
const LOCAL_SKILLS = ["improve-codebase-architecture"] as const

/** base Skills removed from the subscription; nothing may still route to them. */
const REMOVED_BASE_SKILLS = [
  "ask-matt",
  "code-review",
  "codebase-design",
  "domain-modeling",
  "grill-with-docs",
  "grilling",
  "implement",
  "research",
  "resolving-merge-conflicts",
  "setup-matt-pocock-skills",
  "tdd",
  "to-spec",
  "to-tickets",
  "triage",
  "wayfinder",
] as const

function readOverrides(): {
  skills: Record<
    string,
    {
      plugin: string
      ownership?: string
      provenance?: Record<string, string>
      exclude_files?: string[]
      patches?: Array<{ type: string; pattern?: string; with?: string }>
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
      expect(entry?.provenance?.repo, skill).toBe("mattpocock/skills")
      expect(entry?.provenance?.forked_at_sha, skill).toMatch(/^[0-9a-f]{40}$/)
      expect(entry?.provenance?.license, skill).toContain("license")
      expect(existsSync(join(ROOT, "plugins", entry!.plugin, "skills", skill)), skill).toBe(true)
    }

    expect(upstreamOwnedNames(overrides.skills)).not.toContain(LOCAL_SKILLS[0])
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

  it("does not expose commands for excluded Archify tests", () => {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, "plugins", "plus", "skills", "archify", "package.json"), "utf-8"),
    ) as { scripts?: Record<string, string> }
    const archifyScripts = Object.values(manifest.scripts ?? {})
    expect(archifyScripts.join("\n")).not.toContain("test/")
    // The published payload root is skills/archify, so "../scripts" and
    // "../docs" resolve outside it and can never run for an installed skill.
    for (const script of archifyScripts) {
      expect(script, script).not.toContain("../")
    }
    const schemaReadme = readFileSync(
      join(ROOT, "plugins", "plus", "skills", "archify", "schemas", "README.md"),
      "utf-8",
    )
    expect(schemaReadme).not.toContain("`npm test`")
    expect(schemaReadme).toContain("`npm run check:validators`")
    const archifyDocs = textFiles(join(ROOT, "plugins", "plus", "skills", "archify"))
      .filter((path) => path.endsWith(".md"))
    for (const path of archifyDocs) {
      const doc = readFileSync(path, "utf-8")
      expect(doc, path).not.toContain("docs/guide.html")
      expect(doc, path).not.toContain("docs/gallery.html")
      expect(doc, path).not.toContain("examples/web-app.html")
      expect(doc, path).not.toContain("web-app-rendered.html")
    }
  })

  it("keeps nuclear-review renamed throughout runtime files", () => {
    const agent = join(ROOT, "plugins", "plus", "agents", "nuclear-review.md")
    expect(existsSync(agent)).toBe(true)
    expect(existsSync(join(ROOT, "plugins", "plus", "skills", "nuclear-review", "agents"))).toBe(false)
    const runtime = textFiles(join(ROOT, "plugins"))
      .map((path) => readFileSync(path, "utf-8"))
      .join("\n")
    expect(runtime).not.toContain("thermo-nuclear-code-quality-review")
    expect(runtime).not.toContain("Thermo-Nuclear Code Quality Review")
    expect(runtime).toContain('subagent_type: "nuclear-review"')
  })

  it("removes unavailable hai skill references from the selected subset", () => {
    const selected = ["razor"]
    const content = selected
      .flatMap((skill) => textFiles(join(ROOT, "plugins", "plus", "skills", skill)))
      .map((path) => readFileSync(path, "utf-8"))
      .join("\n")
    expect(content).not.toMatch(/\b(?:hai-goal|hai-prd|hai-naming|hai-architecture|hai-tdd|hai-rewrite-doc|entity-model-auditor|hai-audit-docs-internally|hai-audit-docs-against-code|hai-idea)\b/)
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

  it("declares the diagnosing-bugs dependency removals as replayable patches", () => {
    const patches = readOverrides().skills["diagnosing-bugs"]?.patches ?? []
    const skill = readFileSync(
      join(ROOT, "plugins", "base", "skills", "diagnosing-bugs", "SKILL.md"),
      "utf-8",
    )

    // Fixed CONTEXT.md/ADR layout and the /improve-codebase-architecture handoff
    // are both removed declaratively, so a forced upstream replay reapplies them.
    for (const marker of ["`CONTEXT.md`", "/improve-codebase-architecture"]) {
      expect(skill, marker).not.toContain(marker)
      expect(
        patches.some((patch) => patch.type === "replace" && patch.pattern?.includes(marker)),
        `diagnosing-bugs patch for ${marker}`,
      ).toBe(true)
    }

    // The debugging discipline the Skill exists for must survive the patches.
    expect(skill).toContain("Phase 1 — Build a feedback loop")
    expect(skill).toContain("### Tighten the loop")
    expect(skill).toContain("Phase 5 — Fix + regression test")
    expect(skill).toContain("No red-capable command, no Phase 2.")
  })

  it("renames the upstream grilling payload to grill-me declaratively", () => {
    const entry = readOverrides().skills["grill-me"]
    expect((entry as { source?: { path?: string } })?.source?.path).toBe("skills/productivity/grilling")
    expect(
      entry?.patches?.some(
        (patch) => patch.type === "set_frontmatter" && (patch as { field?: string }).field === "name",
      ),
    ).toBe(true)
    expect(entry?.target_patches?.map(({ target }) => target)).toContain("agents/openai.yaml")

    // The interview protocol is inlined; the old wrapper only forwarded to /grilling.
    const skill = readFileSync(join(ROOT, "plugins", "base", "skills", "grill-me", "SKILL.md"), "utf-8")
    expect(skill).toContain("Interview me relentlessly")
    expect(skill).not.toContain("Run a `/grilling` session")
  })

  it("keeps the local architecture skill free of removed skill and subagent calls", () => {
    const dir = join(ROOT, "plugins", "base", "skills", "improve-codebase-architecture")
    const content = textFiles(dir).map((path) => readFileSync(path, "utf-8")).join("\n")

    for (const marker of [
      "/codebase-design",
      "/grilling",
      "/domain-modeling",
      "subagent_type",
      "`CONTEXT.md`",
      "docs/adr/",
    ]) {
      expect(content, marker).not.toContain(marker)
    }

    // Self-contained rubric plus the HTML report flow must stay intact.
    const skill = readFileSync(join(dir, "SKILL.md"), "utf-8")
    expect(skill).toContain("## Architecture rubric")
    expect(skill).toContain("The deletion test")
    expect(skill).toContain("architecture-review-<timestamp>.html")
    expect(skill).toContain("Which of these would you like to explore?")
    const deepening = readFileSync(join(dir, "DEEPENING.md"), "utf-8")
    for (const dependencyClass of [
      "In-process",
      "Local-substitutable",
      "Remote but owned",
      "True external",
    ]) {
      expect(deepening).toContain(dependencyClass)
    }
    expect(deepening).toContain("Testing strategy: replace, don't layer")
    expect(skill).toContain("update the project's existing glossary or domain document immediately")
    expect(existsSync(join(dir, "HTML-REPORT.md"))).toBe(true)
  })

  it("keeps only the approved plugin-level assets", () => {
    expect(existsSync(join(ROOT, "plugins", "plus", "hooks"))).toBe(false)
    expect(existsSync(join(ROOT, "plugins", "plus", "agents", "nuclear-review.md"))).toBe(true)
    expect(existsSync(join(ROOT, "plugins", "base", "rules"))).toBe(false)
    expect(existsSync(join(ROOT, "plugins", "plus", "rules"))).toBe(false)
  })
})
