/**
 * Generate Claude Code, Cursor, and Codex marketplace & plugin manifests from marketplace.yaml.
 * Usage: npx tsx scripts/build-marketplace.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { parse as parseYaml } from "yaml"
import {
  generateClaudeMarketplace,
  generateCodexMarketplace,
  generateCodexPluginManifest,
  generateCursorMarketplace,
  generateCursorPluginManifest,
  type MarketplaceConfig,
} from "./marketplace-generator.js"

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "")

function writeJson(filePath: string, data: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

const config = parseYaml(
  readFileSync(join(ROOT, "marketplace.yaml"), "utf-8"),
) as MarketplaceConfig

// 1. Claude Code: .claude-plugin/marketplace.json
const claudeOut = join(ROOT, ".claude-plugin", "marketplace.json")
writeJson(claudeOut, generateClaudeMarketplace(config))

// 2. Cursor: .cursor-plugin/marketplace.json + plugins/<name>/.cursor-plugin/plugin.json
const cursorOut = join(ROOT, ".cursor-plugin", "marketplace.json")
writeJson(cursorOut, generateCursorMarketplace(config))

// 3. Codex: .agents/plugins/marketplace.json + plugins/<name>/.codex-plugin/plugin.json
const codexOut = join(ROOT, ".agents", "plugins", "marketplace.json")
writeJson(codexOut, generateCodexMarketplace(config))

const pluginManifests: string[] = []
for (const plugin of config.plugins) {
  const pluginDir = join(ROOT, plugin.source)

  const cursorManifestOut = join(pluginDir, ".cursor-plugin", "plugin.json")
  writeJson(cursorManifestOut, generateCursorPluginManifest(config, plugin))
  pluginManifests.push(`${plugin.source}/.cursor-plugin/plugin.json`)

  const codexManifestOut = join(pluginDir, ".codex-plugin", "plugin.json")
  writeJson(codexManifestOut, generateCodexPluginManifest(config, plugin))
  pluginManifests.push(`${plugin.source}/.codex-plugin/plugin.json`)
}

console.log(
  `✅ Generated manifests (${config.plugins.length} plugin(s)): ` +
    [
      ".claude-plugin/marketplace.json",
      ".cursor-plugin/marketplace.json",
      ".agents/plugins/marketplace.json",
      ...pluginManifests,
    ].join(", "),
)
