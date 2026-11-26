export interface MarketplaceOwner {
  readonly name: string
  readonly url?: string
}

export interface MarketplacePluginConfig {
  readonly name: string
  readonly displayName?: string
  readonly version: string
  readonly source: string
  readonly description: string
  readonly strict?: boolean
  readonly category?: string
  readonly keywords?: readonly string[]
}

export interface MarketplaceConfig {
  readonly name: string
  readonly displayName?: string
  readonly owner: MarketplaceOwner
  readonly repository?: string
  readonly license?: string
  readonly metadata?: {
    readonly description?: string
    readonly version?: string
  }
  readonly plugins: readonly MarketplacePluginConfig[]
}

export interface ClaudeMarketplace {
  readonly name: string
  readonly owner: MarketplaceOwner
  readonly metadata?: {
    readonly description?: string
    readonly version?: string
  }
  readonly plugins: readonly MarketplacePluginConfig[]
}

export interface CursorMarketplacePlugin {
  readonly name: string
  readonly source: string
  readonly description: string
  readonly version: string
  readonly author: MarketplaceOwner
  readonly category?: string
  readonly tags?: readonly string[]
}

export interface CursorMarketplace {
  readonly name: string
  readonly owner: MarketplaceOwner
  readonly metadata?: {
    readonly description?: string
    readonly version?: string
  }
  readonly plugins: readonly CursorMarketplacePlugin[]
}

export interface CursorPluginManifest {
  readonly name: string
  readonly version: string
  readonly description: string
  readonly author: MarketplaceOwner
  readonly repository?: string
  readonly license?: string
  readonly keywords?: readonly string[]
  readonly skills: string
}

export interface CodexMarketplacePlugin {
  readonly name: string
  readonly source: {
    readonly source: "local"
    readonly path: string
  }
  readonly policy: {
    readonly installation: "AVAILABLE"
    readonly authentication: "ON_INSTALL"
  }
  readonly category: string
}

export interface CodexMarketplace {
  readonly name: string
  readonly interface: {
    readonly displayName: string
  }
  readonly plugins: readonly CodexMarketplacePlugin[]
}

export interface CodexPluginManifest {
  readonly name: string
  readonly version: string
  readonly description: string
  readonly author: MarketplaceOwner
  readonly repository?: string
  readonly license?: string
  readonly keywords?: readonly string[]
  readonly skills: string
  readonly interface: {
    readonly displayName: string
    readonly shortDescription: string
    readonly developerName: string
    readonly category: string
  }
}

function stripLeadingDotSlash(path: string): string {
  return path.replace(/^\.\//, "")
}

function ensureLeadingDotSlash(path: string): string {
  return path.startsWith("./") ? path : `./${path}`
}

function toTitleCategory(category?: string): string {
  if (!category) return "Productivity"
  return category.charAt(0).toUpperCase() + category.slice(1)
}

export function generateClaudeMarketplace(config: MarketplaceConfig): ClaudeMarketplace {
  return {
    name: config.name,
    owner: config.owner,
    ...(config.metadata ? { metadata: config.metadata } : {}),
    plugins: config.plugins.map((plugin) => ({
      name: plugin.name,
      version: plugin.version,
      source: plugin.source,
      description: plugin.description,
      ...(plugin.strict !== undefined ? { strict: plugin.strict } : {}),
      ...(plugin.category ? { category: plugin.category } : {}),
      ...(plugin.keywords ? { keywords: plugin.keywords } : {}),
    })),
  }
}

export function generateCursorMarketplace(config: MarketplaceConfig): CursorMarketplace {
  return {
    name: config.name,
    owner: config.owner,
    ...(config.metadata ? { metadata: config.metadata } : {}),
    plugins: config.plugins.map((plugin) => ({
      name: plugin.name,
      source: stripLeadingDotSlash(plugin.source),
      description: plugin.description,
      version: plugin.version,
      author: config.owner,
      ...(plugin.category ? { category: plugin.category } : {}),
      ...(plugin.keywords ? { tags: plugin.keywords } : {}),
    })),
  }
}

export function generateCursorPluginManifest(
  config: MarketplaceConfig,
  plugin: MarketplacePluginConfig,
): CursorPluginManifest {
  return {
    name: plugin.name,
    version: plugin.version,
    description: plugin.description,
    author: config.owner,
    ...(config.repository ? { repository: config.repository } : {}),
    ...(config.license ? { license: config.license } : {}),
    ...(plugin.keywords ? { keywords: plugin.keywords } : {}),
    skills: "./skills/",
  }
}

export function generateCodexMarketplace(config: MarketplaceConfig): CodexMarketplace {
  return {
    name: config.name,
    interface: {
      displayName: config.displayName ?? config.name,
    },
    plugins: config.plugins.map((plugin) => ({
      name: plugin.name,
      source: {
        source: "local",
        path: ensureLeadingDotSlash(plugin.source),
      },
      policy: {
        installation: "AVAILABLE",
        authentication: "ON_INSTALL",
      },
      category: toTitleCategory(plugin.category),
    })),
  }
}

export function generateCodexPluginManifest(
  config: MarketplaceConfig,
  plugin: MarketplacePluginConfig,
): CodexPluginManifest {
  return {
    name: plugin.name,
    version: plugin.version,
    description: plugin.description,
    author: config.owner,
    ...(config.repository ? { repository: config.repository } : {}),
    ...(config.license ? { license: config.license } : {}),
    ...(plugin.keywords ? { keywords: plugin.keywords } : {}),
    skills: "./skills/",
    interface: {
      displayName: plugin.displayName ?? plugin.name,
      shortDescription: plugin.description,
      developerName: config.owner.name,
      category: toTitleCategory(plugin.category),
    },
  }
}
