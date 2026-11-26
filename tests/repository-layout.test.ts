import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { parse as parseYaml } from "yaml"
import {
  generateClaudeMarketplace,
  generateCodexMarketplace,
  generateCodexPluginManifest,
  generateCursorMarketplace,
  generateCursorPluginManifest,
  type MarketplaceConfig,
} from "../scripts/marketplace-generator.js"

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "")

interface OverrideSkillConfig {
  readonly ownership?: "local"
  readonly source?: { readonly repo: string; readonly path: string; readonly ref?: string }
  readonly plugin: string
}

interface OverridesConfig {
  readonly skills: Record<string, OverrideSkillConfig>
}

function listSkillDirs(plugin: string): string[] {
  const skillsRoot = join(ROOT, "plugins", plugin, "skills")
  if (!existsSync(skillsRoot)) return []
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

describe("repository layout", () => {
  const marketplace = parseYaml(
    readFileSync(join(ROOT, "marketplace.yaml"), "utf-8"),
  ) as MarketplaceConfig
  const overrides = parseYaml(
    readFileSync(join(ROOT, "overrides.yaml"), "utf-8"),
  ) as OverridesConfig
  const syncState = JSON.parse(
    readFileSync(join(ROOT, ".sync-state.json"), "utf-8"),
  ) as Record<string, { sha: string; files: string[] }>

  it("uses a single unified core plugin with every skill declared in overrides.yaml", () => {
    expect(marketplace.plugins.map((p) => p.name)).toEqual(["core"])

    const diskSkills = listSkillDirs("core")
    const declaredSkills = Object.keys(overrides.skills).sort()
    expect(diskSkills).toEqual(declaredSkills)
    expect(diskSkills.length).toBe(11)

    for (const [name, cfg] of Object.entries(overrides.skills)) {
      expect(cfg.plugin).toBe("core")
      const skillMdPath = join(ROOT, "plugins", "core", "skills", name, "SKILL.md")
      expect(existsSync(skillMdPath), `missing SKILL.md for ${name}`).toBe(true)
      const content = readFileSync(skillMdPath, "utf-8")
      expect(content).toMatch(new RegExp(`^---\\n[\\s\\S]*?^name:\\s*${name}\\s*$`, "m"))
    }
  })

  it("keeps .sync-state.json aligned strictly with upstream-synced skills", () => {
    const upstreamSkills = Object.entries(overrides.skills)
      .filter(([, cfg]) => cfg.ownership !== "local" && cfg.source !== undefined)
      .map(([name]) => name)
      .sort()
    const stateKeys = Object.keys(syncState).sort()
    expect(stateKeys).toEqual(upstreamSkills)
  })

  it("keeps package.json pi.skills pointing directly to ./plugins/core/skills without /matt extension", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as {
      pi?: { skills?: string[]; extensions?: string[] }
    }
    expect(pkg.pi?.skills).toEqual(["./plugins/core/skills"])
    expect(pkg.pi?.extensions).toBeUndefined()
  })

  it("keeps generated Claude Code, Cursor, and Codex manifests in sync with marketplace.yaml", () => {
    const claudeJson = JSON.parse(
      readFileSync(join(ROOT, ".claude-plugin", "marketplace.json"), "utf-8"),
    )
    expect(claudeJson).toEqual(generateClaudeMarketplace(marketplace))

    const cursorJson = JSON.parse(
      readFileSync(join(ROOT, ".cursor-plugin", "marketplace.json"), "utf-8"),
    )
    expect(cursorJson).toEqual(generateCursorMarketplace(marketplace))

    const codexJson = JSON.parse(
      readFileSync(join(ROOT, ".agents", "plugins", "marketplace.json"), "utf-8"),
    )
    expect(codexJson).toEqual(generateCodexMarketplace(marketplace))

    for (const plugin of marketplace.plugins) {
      const cursorPluginJson = JSON.parse(
        readFileSync(join(ROOT, plugin.source, ".cursor-plugin", "plugin.json"), "utf-8"),
      )
      expect(cursorPluginJson).toEqual(generateCursorPluginManifest(marketplace, plugin))

      const codexPluginJson = JSON.parse(
        readFileSync(join(ROOT, plugin.source, ".codex-plugin", "plugin.json"), "utf-8"),
      )
      expect(codexPluginJson).toEqual(generateCodexPluginManifest(marketplace, plugin))
    }
  })
})
