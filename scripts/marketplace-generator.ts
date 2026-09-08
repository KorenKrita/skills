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
  readonly version: string
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
  readonly version?: string
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
        version: pluginConfig.version,
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

// ─── Cursor ──────────────────────────────────────────────────────────────────
// Cursor 只读 `.cursor-plugin/marketplace.json` 与 `<source>/.cursor-plugin/plugin.json`，
// 不识别 `.claude-plugin/`。见 https://cursor.com/docs/reference/plugins

export interface CursorMarketplaceJson {
  readonly name: string
  readonly owner: { readonly name: string }
  readonly metadata: { readonly description: string }
  readonly plugins: CursorMarketplacePluginEntry[]
}

export interface CursorMarketplacePluginEntry {
  readonly name: string
  readonly source: string
  readonly description: string
  readonly version?: string
  readonly category?: string
  readonly keywords?: readonly string[]
}

export interface CursorPluginJson {
  readonly name: string
  readonly version: string
  readonly description: string
  readonly author: { readonly name: string }
  readonly repository: string
  readonly keywords?: readonly string[]
}

export interface CursorManifests {
  readonly marketplace: CursorMarketplaceJson
  /** key = plugin 目录名（plugins/<name>），value = 该目录下 .cursor-plugin/plugin.json 内容 */
  readonly plugins: Record<string, CursorPluginJson>
}

export const generateCursorManifests = (
  config: MarketplaceConfig,
  dirs: readonly PluginDir[],
  repository: string,
): Effect.Effect<CursorManifests> =>
  Effect.gen(function* () {
    const existingPluginNames = new Set(dirs.map((d) => d.name))
    const localPlugins = Object.entries(config.plugins).filter(([name]) =>
      existingPluginNames.has(name),
    )

    const entries: CursorMarketplacePluginEntry[] = localPlugins.map(([name, p]) => ({
      name,
      source: `plugins/${name}`,
      description: p.description,
      version: p.version,
      ...(p.category && { category: p.category }),
      ...(p.keywords && { keywords: p.keywords }),
    }))

    const plugins: Record<string, CursorPluginJson> = Object.fromEntries(
      localPlugins.map(([name, p]) => [
        name,
        {
          name,
          version: p.version,
          description: p.description,
          author: config.marketplace.owner,
          repository,
          ...(p.keywords && { keywords: p.keywords }),
        },
      ]),
    )

    return {
      marketplace: {
        name: config.marketplace.name,
        owner: config.marketplace.owner,
        metadata: { description: config.marketplace.description },
        plugins: entries,
      },
      plugins,
    }
  })
