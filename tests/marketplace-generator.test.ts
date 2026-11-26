import { describe, expect, it } from "vitest"
import {
  generateClaudeMarketplace,
  generateCodexMarketplace,
  generateCodexPluginManifest,
  generateCursorMarketplace,
  generateCursorPluginManifest,
  type MarketplaceConfig,
} from "../scripts/marketplace-generator.js"

const sampleConfig: MarketplaceConfig = {
  name: "korenkrita-skills",
  displayName: "KorenKrita Skills",
  owner: {
    name: "KorenKrita",
    url: "https://github.com/KorenKrita",
  },
  repository: "https://github.com/KorenKrita/skills",
  license: "MIT",
  metadata: {
    description: "test marketplace",
    version: "1.0.0",
  },
  plugins: [
    {
      name: "core",
      displayName: "KorenKrita Core Skills",
      version: "1.0.0",
      source: "./plugins/core",
      description: "Core curated skills",
      strict: false,
      category: "productivity",
      keywords: ["skills", "architecture"],
    },
  ],
}

describe("marketplace-generator", () => {
  it("generates Claude Code marketplace.json preserving strict and ./ source prefix", () => {
    const out = generateClaudeMarketplace(sampleConfig)
    expect(out.name).toBe("korenkrita-skills")
    expect(out.plugins).toHaveLength(1)
    expect(out.plugins[0]).toEqual({
      name: "core",
      version: "1.0.0",
      source: "./plugins/core",
      description: "Core curated skills",
      strict: false,
      category: "productivity",
      keywords: ["skills", "architecture"],
    })
  })

  it("generates Cursor marketplace.json stripping leading ./ and mapping keywords to tags", () => {
    const out = generateCursorMarketplace(sampleConfig)
    expect(out.plugins[0]).toEqual({
      name: "core",
      source: "plugins/core",
      description: "Core curated skills",
      version: "1.0.0",
      author: sampleConfig.owner,
      category: "productivity",
      tags: ["skills", "architecture"],
    })
  })

  it("generates Cursor plugin.json with skills: ./skills/", () => {
    const manifest = generateCursorPluginManifest(sampleConfig, sampleConfig.plugins[0]!)
    expect(manifest).toEqual({
      name: "core",
      version: "1.0.0",
      description: "Core curated skills",
      author: sampleConfig.owner,
      repository: "https://github.com/KorenKrita/skills",
      license: "MIT",
      keywords: ["skills", "architecture"],
      skills: "./skills/",
    })
  })

  it("generates Codex marketplace.json with local path and install policy", () => {
    const out = generateCodexMarketplace(sampleConfig)
    expect(out).toEqual({
      name: "korenkrita-skills",
      interface: {
        displayName: "KorenKrita Skills",
      },
      plugins: [
        {
          name: "core",
          source: {
            source: "local",
            path: "./plugins/core",
          },
          policy: {
            installation: "AVAILABLE",
            authentication: "ON_INSTALL",
          },
          category: "Productivity",
        },
      ],
    })
  })

  it("generates Codex plugin.json with skills path and interface metadata", () => {
    const manifest = generateCodexPluginManifest(sampleConfig, sampleConfig.plugins[0]!)
    expect(manifest).toEqual({
      name: "core",
      version: "1.0.0",
      description: "Core curated skills",
      author: sampleConfig.owner,
      repository: "https://github.com/KorenKrita/skills",
      license: "MIT",
      keywords: ["skills", "architecture"],
      skills: "./skills/",
      interface: {
        displayName: "KorenKrita Core Skills",
        shortDescription: "Core curated skills",
        developerName: "KorenKrita",
        category: "Productivity",
      },
    })
  })
})
