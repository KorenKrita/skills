import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { generateMarketplace, type MarketplaceConfig, type PluginDir } from "../scripts/marketplace-generator.js"

const SAMPLE_CONFIG: MarketplaceConfig = {
  marketplace: {
    name: "korenkrita-skills",
    owner: { name: "KorenKrita" },
    description: "KorenKrita 的 skill 聚合库",
  },
  plugins: {
    coding: {
      version: "0.0.1",
      description: "编码过程中的辅助工具",
      category: "engineering",
      keywords: ["tdd", "debug"],
    },
    tools: {
      version: "0.2.3",
      description: "通用工具",
      category: "productivity",
      keywords: ["handoff"],
    },
  },
}

const SAMPLE_DIRS: PluginDir[] = [
  { name: "coding", skills: ["tdd", "diagnose", "zoom-out"] },
  { name: "tools", skills: ["handoff"] },
]

describe("marketplace-generator", () => {
  it.effect("generates valid marketplace.json structure", () =>
    Effect.gen(function* () {
      const result = yield* generateMarketplace(SAMPLE_CONFIG, SAMPLE_DIRS)
      expect(result.name).toBe("korenkrita-skills")
      expect(result.owner.name).toBe("KorenKrita")
      expect(result.plugins).toHaveLength(2)
    }),
  )

  it.effect("sets strict: false on all plugin entries", () =>
    Effect.gen(function* () {
      const result = yield* generateMarketplace(SAMPLE_CONFIG, SAMPLE_DIRS)
      for (const plugin of result.plugins) {
        expect(plugin.strict).toBe(false)
      }
    }),
  )

  it.effect("uses relative path as plugin source", () =>
    Effect.gen(function* () {
      const result = yield* generateMarketplace(SAMPLE_CONFIG, SAMPLE_DIRS)
      const coding = result.plugins.find((p) => p.name === "coding")
      expect(coding!.source).toBe("./plugins/coding")
    }),
  )

  it.effect("includes metadata from marketplace.yaml", () =>
    Effect.gen(function* () {
      const result = yield* generateMarketplace(SAMPLE_CONFIG, SAMPLE_DIRS)
      const coding = result.plugins.find((p) => p.name === "coding")
      expect(coding!.version).toBe("0.0.1")
      expect(coding!.description).toBe("编码过程中的辅助工具")
      expect(coding!.category).toBe("engineering")
      expect(coding!.keywords).toEqual(["tdd", "debug"])
    }),
  )

  it.effect("only includes plugins that exist in directory scan", () =>
    Effect.gen(function* () {
      const dirsWithMissing: PluginDir[] = [
        { name: "coding", skills: ["tdd"] },
      ]
      const result = yield* generateMarketplace(SAMPLE_CONFIG, dirsWithMissing)
      expect(result.plugins).toHaveLength(1)
      expect(result.plugins[0]!.name).toBe("coding")
    }),
  )
})
