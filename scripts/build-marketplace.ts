import { Effect } from "effect"
import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { parse as parseYaml } from "yaml"
import {
  generateCursorManifests,
  generateMarketplace,
  type MarketplaceConfig,
  type PluginDir,
} from "./marketplace-generator.js"

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "")
const REPOSITORY = "https://github.com/KorenKrita/skills"

const readConfig = (): MarketplaceConfig => {
  const raw = readFileSync(join(ROOT, "marketplace.yaml"), "utf-8")
  return parseYaml(raw) as MarketplaceConfig
}

const scanPlugins = (): PluginDir[] => {
  const pluginsDir = join(ROOT, "plugins")
  const entries = readdirSync(pluginsDir)
  return entries
    .filter((name) => statSync(join(pluginsDir, name)).isDirectory())
    .map((name) => {
      const skillsDir = join(pluginsDir, name, "skills")
      let skills: string[] = []
      try {
        skills = readdirSync(skillsDir).filter((s) =>
          statSync(join(skillsDir, s)).isDirectory(),
        )
      } catch {}
      return { name, skills }
    })
}

const writeJson = (path: string, value: unknown): void => {
  mkdirSync(join(path, ".."), { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n")
}

const program = Effect.gen(function* () {
  const config = readConfig()
  const dirs = scanPlugins()

  // Claude Code
  const marketplace = yield* generateMarketplace(config, dirs)
  writeJson(join(ROOT, ".claude-plugin", "marketplace.json"), marketplace)
  console.log(`✅ 生成 .claude-plugin/marketplace.json（${marketplace.plugins.length} 个 plugin）`)

  // Cursor
  const cursor = yield* generateCursorManifests(config, dirs, REPOSITORY)
  writeJson(join(ROOT, ".cursor-plugin", "marketplace.json"), cursor.marketplace)
  for (const [name, manifest] of Object.entries(cursor.plugins)) {
    writeJson(join(ROOT, "plugins", name, ".cursor-plugin", "plugin.json"), manifest)
  }
  console.log(
    `✅ 生成 .cursor-plugin/marketplace.json + ${Object.keys(cursor.plugins).length} 个 plugins/*/.cursor-plugin/plugin.json`,
  )
})

Effect.runPromise(program)
