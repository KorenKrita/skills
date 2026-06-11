import { Effect } from "effect"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MarketplaceConfig {
  readonly marketplace: {
    readonly name: string
    readonly owner: { readonly name: string }
    readonly description: string
  }
  readonly plugins: Record<string, PluginConfig>
  readonly external_plugins?: Record<string, ExternalPluginConfig>
}

export interface PluginConfig {
  readonly description: string
  readonly category?: string
  readonly keywords?: readonly string[]
}

export interface ExternalPluginConfig {
  readonly source: { readonly type: string; readonly repo: string }
  readonly description: string
  readonly category?: string
  readonly strict?: boolean
  readonly keywords?: readonly string[]
}

export interface PluginDir {
  readonly name: string
  readonly skills: readonly string[]
}

export interface MarketplaceJson {
  readonly name: string
  readonly owner: { readonly name: string }
  readonly description: string
  readonly plugins: MarketplacePluginEntry[]
}

export interface MarketplacePluginEntry {
  readonly name: string
  readonly source: string | { readonly source: string; readonly repo: string }
  readonly description: string
  readonly strict: false
  readonly category?: string
  readonly keywords?: readonly string[]
}

// ─── Generator ───────────────────────────────────────────────────────────────

export const generateMarketplace = (
  config: MarketplaceConfig,
  dirs: readonly PluginDir[],
): Effect.Effect<MarketplaceJson> =>
  Effect.gen(function* () {
    const existingPluginNames = new Set(dirs.map((d) => d.name))

    const plugins: MarketplacePluginEntry[] = Object.entries(config.plugins)
      .filter(([name]) => existingPluginNames.has(name))
      .map(([name, pluginConfig]) => ({
        name,
        source: `./plugins/${name}`,
        description: pluginConfig.description,
        strict: false as const,
        ...(pluginConfig.category && { category: pluginConfig.category }),
        ...(pluginConfig.keywords && { keywords: pluginConfig.keywords }),
      }))

    const externalPlugins = Object.entries(config.external_plugins ?? {})
      .map(([name, ext]) => ({
        name,
        source: { source: ext.source.type, repo: ext.source.repo },
        description: ext.description,
        ...(ext.strict === false && { strict: false as const }),
        ...(ext.category && { category: ext.category }),
        ...(ext.keywords && { keywords: ext.keywords }),
      })) as MarketplacePluginEntry[]

    return {
      name: config.marketplace.name,
      owner: config.marketplace.owner,
      description: config.marketplace.description,
      plugins: [...plugins, ...externalPlugins],
    }
  })
