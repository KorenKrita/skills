import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { parse as parseYaml } from "yaml"
import { isExcludedFile } from "../scripts/sync-utils.js"

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "")
const PLUGINS = ["base", "plus", "creative"] as const

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
    "improve-codebase-architecture",
    "prototype",
    "research",
    "resolving-merge-conflicts",
    "setup-matt-pocock-skills",
    "tdd",
    "teach",
    "to-spec",
    "to-tickets",
    "triage",
    "wayfinder",
    "writing-great-skills",
  ],
  plus: [
    "docs-vs-code",
    "docs-vs-docs",
    "fan-out",
    "geju",
    "goal-gen",
    "goudi",
    "i-have-adhd",
    "idea",
    "improve",
    "pua",
    "nuclear-review",
    "ocr",
    "razor",
    "read",
  ],
  creative: [
    "archify",
    "humanizer-zh",
    "xiaohei",
    "kami",
    "ui",
    "web",
    "xiaohei2",
  ],
} as const

const EXPECTED_SKILL_COUNT = Object.values(EXPECTED_SKILLS).flat().length

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
  it("publishes exactly base, plus, and creative", () => {
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
    expect(skillNames("creative")).toEqual([...EXPECTED_SKILLS.creative].sort())
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
    const overrides = parseYaml(readFileSync(join(ROOT, "overrides.yaml"), "utf-8")) as {
      skills: Record<string, { plugin: string }>
    }
    const state = JSON.parse(readFileSync(join(ROOT, ".sync-state.json"), "utf-8")) as Record<string, unknown>
    expect(Object.keys(state).sort()).toEqual(Object.keys(overrides.skills).sort())
    expect(Object.keys(overrides.skills)).toHaveLength(42)
    for (const [skill, config] of Object.entries(overrides.skills)) {
      expect(existsSync(join(ROOT, "plugins", config.plugin, "skills", skill)), skill).toBe(true)
    }
  })

  it("does not publish files excluded by sync rules", () => {
    const overrides = parseYaml(readFileSync(join(ROOT, "overrides.yaml"), "utf-8")) as {
      skills: Record<
        string,
        {
          plugin: string
          exclude_files?: string[]
          target_patches?: Array<{ target: string }>
        }
      >
    }
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
      readFileSync(join(ROOT, "plugins", "creative", "skills", "archify", "package.json"), "utf-8"),
    ) as { scripts?: Record<string, string> }
    expect(Object.values(manifest.scripts ?? {}).join("\n")).not.toContain("test/")
    const schemaReadme = readFileSync(
      join(ROOT, "plugins", "creative", "skills", "archify", "schemas", "README.md"),
      "utf-8",
    )
    expect(schemaReadme).not.toContain("`npm test`")
    expect(schemaReadme).toContain("`npm run check:validators`")
    const skill = readFileSync(
      join(ROOT, "plugins", "creative", "skills", "archify", "SKILL.md"),
      "utf-8",
    )
    expect(skill).not.toContain("docs/guide.html")
    expect(skill).not.toContain("examples/web-app.html")
    expect(skill).toContain("examples/web-app.architecture.json")
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

  it("keeps both Xiaohei skills on their local runtime names", () => {
    const xiaohei = join(ROOT, "plugins", "creative", "skills", "xiaohei")
    const xiaohei2 = join(ROOT, "plugins", "creative", "skills", "xiaohei2")
    expect(frontmatterName(join(xiaohei, "SKILL.md"))).toBe("xiaohei")
    expect(frontmatterName(join(xiaohei2, "SKILL.md"))).toBe("xiaohei2")

    const runtime = [...textFiles(xiaohei), ...textFiles(xiaohei2)]
      .map((path) => readFileSync(path, "utf-8"))
      .join("\n")
    expect(runtime).not.toContain("$ian-xiaohei-illustrations")
    expect(runtime).not.toContain("$ian-xiaohei-scenes")
    expect(runtime).toContain("$xiaohei")
    expect(runtime).toContain("$xiaohei2")
  })

  it("removes unavailable hai skill references from the selected subset", () => {
    const selected = ["docs-vs-code", "docs-vs-docs", "geju", "goudi", "idea", "razor"]
    const content = selected
      .flatMap((skill) => textFiles(join(ROOT, "plugins", "plus", "skills", skill)))
      .map((path) => readFileSync(path, "utf-8"))
      .join("\n")
    expect(content).not.toMatch(/\b(?:hai-goal|hai-prd|hai-naming|hai-architecture|hai-tdd|hai-rewrite-doc|entity-model-auditor|hai-audit-docs-internally|hai-audit-docs-against-code|hai-idea)\b/)
    expect(content).not.toContain("SKILL.zh_CN.md")
  })

  it("keeps only the approved plugin-level assets", () => {
    expect(existsSync(join(ROOT, "plugins", "plus", "hooks", "hooks.json"))).toBe(true)
    expect(existsSync(join(ROOT, "plugins", "plus", "hooks", "ponytail.md"))).toBe(false)
    expect(existsSync(join(ROOT, "plugins", "plus", "agents", "nuclear-review.md"))).toBe(true)
    expect(existsSync(join(ROOT, "plugins", "base", "rules"))).toBe(false)
    expect(existsSync(join(ROOT, "plugins", "plus", "rules"))).toBe(false)
    expect(existsSync(join(ROOT, "plugins", "creative", "rules"))).toBe(false)
  })

  it("ships one complete Kami payload without a nested duplicate", () => {
    const kami = join(ROOT, "plugins", "creative", "skills", "kami")
    expect(existsSync(join(kami, "SKILL.md"))).toBe(true)
    expect(existsSync(join(kami, "CHEATSHEET.md"))).toBe(true)
    expect(existsSync(join(kami, "scripts", "build.py"))).toBe(true)
    expect(existsSync(join(kami, "references", "design.md"))).toBe(true)
    expect(existsSync(join(kami, "assets", "templates"))).toBe(true)
    expect(textFiles(kami).filter((path) => path.endsWith("SKILL.md"))).toHaveLength(1)
    expect(readFileSync(join(kami, "scripts", "package-skill.sh"), "utf-8")).not.toContain(
      "mcp_server.py",
    )
  })
})
