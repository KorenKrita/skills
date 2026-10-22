import { readFileSync } from "node:fs"
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
  try {
    return parseConfig(JSON.parse(readFileSync(join(packageRoot, "pi.config.json"), "utf8")))
  } catch {
    return DEFAULT_CONFIG
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
