import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { homedir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  DEFAULT_CONFIG,
  agentDirFromEnv,
  mergeConfig,
  parseConfig,
  parsePartialConfig,
  readEffectiveConfig,
  resolveEnabled,
  skillPathsFor,
} from "../pi/settings.js"

describe("parseConfig", () => {
  it("falls back to both sets on and no command for a missing or empty document", () => {
    expect(parseConfig(undefined)).toEqual(DEFAULT_CONFIG)
    expect(parseConfig({})).toEqual(DEFAULT_CONFIG)
    expect(DEFAULT_CONFIG.mattCommand).toBe(false)
  })

  it("reads partial defaults and ignores bad types", () => {
    expect(parseConfig({ defaults: { base: false } })).toEqual({
      defaults: { base: false, plus: true },
      mattCommand: false,
    })
    expect(parseConfig({ defaults: { base: "no", plus: false } })).toEqual({
      defaults: { base: true, plus: false },
      mattCommand: false,
    })
    expect(parseConfig({ defaults: [], mattCommand: true }).defaults).toEqual({
      base: true,
      plus: true,
    })
  })

  it("enables the command only from an explicit boolean", () => {
    expect(parseConfig({ mattCommand: true }).mattCommand).toBe(true)
    expect(parseConfig({ mattCommand: 1 }).mattCommand).toBe(false)
  })
})

describe("resolveEnabled", () => {
  const config = parseConfig({ defaults: { base: false, plus: true } })

  it("uses the config defaults without a session override", () => {
    expect(resolveEnabled(config, undefined)).toEqual({ base: false, plus: true })
  })

  it("lets /matt on turn base on for the session", () => {
    expect(resolveEnabled(config, true)).toEqual({ base: true, plus: true })
  })

  it("keeps plus independent of the session override", () => {
    expect(resolveEnabled(config, true).plus).toBe(true)
    expect(resolveEnabled(parseConfig({ defaults: { plus: false } }), true)).toEqual({
      base: true,
      plus: false,
    })
  })
})

describe("skillPathsFor", () => {
  it("returns only the enabled set directories", () => {
    expect(skillPathsFor("/repo", { base: true, plus: true })).toEqual([
      "/repo/plugins/base/skills",
      "/repo/plugins/plus/skills",
    ])
    expect(skillPathsFor("/repo", { base: true, plus: false })).toEqual(["/repo/plugins/base/skills"])
    expect(skillPathsFor("/repo", { base: false, plus: false })).toEqual([])
  })
})

describe("user override", () => {
  it("merges only the keys the user file sets", () => {
    const base = parseConfig({ defaults: { base: true, plus: true }, mattCommand: false })
    expect(mergeConfig(base, { defaults: { base: false } })).toEqual({
      defaults: { base: false, plus: true },
      mattCommand: false,
    })
    expect(mergeConfig(base, { mattCommand: true })).toEqual({
      defaults: { base: true, plus: true },
      mattCommand: true,
    })
  })

  it("ignores keys with bad types and documents that set nothing", () => {
    expect(parsePartialConfig({ defaults: { base: "no", plus: true } })).toEqual({
      defaults: { plus: true },
    })
    expect(parsePartialConfig({})).toBeUndefined()
    expect(parsePartialConfig(null)).toBeUndefined()
    expect(parsePartialConfig({ defaults: { base: 1 } })).toBeUndefined()
  })

  it("lays the user file over the package file", () => {
    const root = mkdtempSync(join(tmpdir(), "skills-cfg-"))
    const agentDir = join(root, "agent")
    mkdirSync(agentDir)
    writeFileSync(join(root, "pi.config.json"), JSON.stringify({ defaults: { base: true, plus: true } }))
    expect(readEffectiveConfig(root, agentDir).defaults).toEqual({ base: true, plus: true })

    writeFileSync(
      join(agentDir, "skills-injection.json"),
      JSON.stringify({ defaults: { base: false }, mattCommand: true }),
    )
    expect(readEffectiveConfig(root, agentDir)).toEqual({
      defaults: { base: false, plus: true },
      mattCommand: true,
    })
  })

  it("falls back to the agent dir environment variable", () => {
    expect(agentDirFromEnv({ PI_CODING_AGENT_DIR: "/tmp/custom" } as NodeJS.ProcessEnv)).toBe("/tmp/custom")
    expect(agentDirFromEnv({} as NodeJS.ProcessEnv)).toBe(join(homedir(), ".pi", "agent"))
  })
})
