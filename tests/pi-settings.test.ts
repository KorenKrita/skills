import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG, parseConfig, resolveEnabled, skillPathsFor } from "../pi/settings.js"

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
