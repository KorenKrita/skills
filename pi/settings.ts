import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/** Skill set name = the directory under plugins/. */
export type SkillSet = "base" | "plus"

export interface SkillsConfig {
  /** Which sets load by default. Missing entries fall back to true. */
  defaults: Record<SkillSet, boolean>
  /** Register the /matt command. Off by default. */
  mattCommand: boolean
}

export const SETS: readonly SkillSet[] = ["base", "plus"]

export const DEFAULT_CONFIG: SkillsConfig = {
  defaults: { base: true, plus: true },
  mattCommand: false,
}

/** Coerce a parsed config document; unknown keys and bad types fall back to defaults. */
export function parseConfig(raw: unknown): SkillsConfig {
  const doc = isObject(raw) ? raw : {}
  const defaults = isObject(doc.defaults) ? doc.defaults : {}
  return {
    defaults: {
      base: boolOr(defaults.base, DEFAULT_CONFIG.defaults.base),
      plus: boolOr(defaults.plus, DEFAULT_CONFIG.defaults.plus),
    },
    mattCommand: boolOr(doc.mattCommand, DEFAULT_CONFIG.mattCommand),
  }
}

/** Read `<packageRoot>/pi.config.json`; a missing or invalid file means defaults. */
export function readConfig(packageRoot: string): SkillsConfig {
  const raw = readJson(join(packageRoot, "pi.config.json"))
  return raw === undefined ? DEFAULT_CONFIG : parseConfig(raw)
}

/**
 * Package config with the user-level file layered on top. The user file holds
 * only the keys it wants to override, so it survives `pi update` replacing the
 * package checkout.
 */
export function readEffectiveConfig(packageRoot: string, agentDir = agentDirFromEnv()): SkillsConfig {
  const base = readConfig(packageRoot)
  const user = parsePartialConfig(readJson(join(agentDir, "skills-injection.json")))
  return user ? mergeConfig(base, user) : base
}

/** Pi's agent directory, honoring the same environment variable Pi reads. */
export function agentDirFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.PI_CODING_AGENT_DIR?.trim()
  return configured && configured.length > 0 ? configured : join(homedir(), ".pi", "agent")
}

/** Overlay `top` onto `base`; a missing key in `top` keeps the base value. */
export function mergeConfig(base: SkillsConfig, top: PartialConfig): SkillsConfig {
  return {
    defaults: {
      base: top.defaults?.base ?? base.defaults.base,
      plus: top.defaults?.plus ?? base.defaults.plus,
    },
    mattCommand: top.mattCommand ?? base.mattCommand,
  }
}

/** Keys a config document may set; used for the user override. */
export type PartialConfig = {
  defaults?: Partial<Record<SkillSet, boolean>>
  mattCommand?: boolean
}

/** Parse a config document without filling defaults; undefined when it sets nothing. */
export function parsePartialConfig(raw: unknown): PartialConfig | undefined {
  if (!isObject(raw)) return undefined
  const partial: PartialConfig = {}
  if (isObject(raw.defaults)) {
    const defaults: Partial<Record<SkillSet, boolean>> = {}
    for (const set of SETS) {
      const value = raw.defaults[set]
      if (typeof value === "boolean") defaults[set] = value
    }
    if (Object.keys(defaults).length > 0) partial.defaults = defaults
  }
  if (typeof raw.mattCommand === "boolean") partial.mattCommand = raw.mattCommand
  return partial.defaults || partial.mattCommand !== undefined ? partial : undefined
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return undefined
  }
}

/**
 * Defaults with this session's override applied. Only `base` can be overridden,
 * by `/matt on`; `plus` follows the config file.
 */
export function resolveEnabled(
  config: SkillsConfig,
  sessionBase: boolean | undefined,
): Record<SkillSet, boolean> {
  return {
    base: sessionBase ?? config.defaults.base,
    plus: config.defaults.plus,
  }
}

/** Skill directories to load, absolute, empty when a set is disabled. */
export function skillPathsFor(
  packageRoot: string,
  enabled: Record<SkillSet, boolean>,
): string[] {
  return SETS.filter((set) => enabled[set]).map((set) => join(packageRoot, "plugins", set, "skills"))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}
