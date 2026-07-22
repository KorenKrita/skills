import { Effect } from "effect"
import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { parse as parseYaml } from "yaml"
import { generateMarketplace, type MarketplaceConfig, type PluginDir } from "./marketplace-generator.js"

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "")

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

const program = Effect.gen(function* () {
  const config = readConfig()
  const dirs = scanPlugins()
  const marketplace = yield* generateMarketplace(config, dirs)

  const outDir = join(ROOT, ".claude-plugin")
  mkdirSync(outDir, { recursive: true })
  writeFileSync(
    join(outDir, "marketplace.json"),
    JSON.stringify(marketplace, null, 2) + "\n",
  )

  console.log(`✅ 生成 .claude-plugin/marketplace.json（${marketplace.plugins.length} 个 plugin）`)
})

Effect.runPromise(program)
