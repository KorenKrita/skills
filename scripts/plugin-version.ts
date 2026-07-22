import { parse as parseYaml, stringify as stringifyYaml } from "yaml"

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/

interface PluginEntry {
  readonly version?: unknown
  readonly [key: string]: unknown
}

interface MarketplaceFile {
  readonly marketplace?: unknown
  readonly plugins?: Record<string, PluginEntry>
  readonly [key: string]: unknown
}

export interface VersionBump {
  readonly content: string
  readonly previousVersion: string
  readonly nextVersion: string
}

export function incrementPatchVersion(version: string): string {
  const match = version.match(SEMVER_PATTERN)
  if (!match) {
    throw new Error(`plugin version 必须是 SemVer x.y.z，当前值: ${version}`)
  }

  const [, major, minor, patch] = match
  return `${major}.${minor}.${Number(patch) + 1}`
}

export function bumpPluginVersion(content: string, pluginName: string): VersionBump {
  const parsed = parseYaml(content) as MarketplaceFile | null
  const plugins = parsed?.plugins
  const plugin = plugins?.[pluginName]

  if (!parsed || !plugins || !plugin) {
    throw new Error(`marketplace.yaml 中不存在 plugin: ${pluginName}`)
  }
  if (typeof plugin.version !== "string") {
    throw new Error(`plugin ${pluginName} 缺少字符串 version`)
  }

  const previousVersion = plugin.version
  const nextVersion = incrementPatchVersion(previousVersion)
  const nextConfig: MarketplaceFile = {
    ...parsed,
    plugins: {
      ...plugins,
      [pluginName]: {
        ...plugin,
        version: nextVersion,
      },
    },
  }

  return {
    content: stringifyYaml(nextConfig, { lineWidth: 0 }),
    previousVersion,
    nextVersion,
  }
}
