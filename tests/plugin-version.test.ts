import { describe, expect, it } from "vitest"
import { parse as parseYaml } from "yaml"
import { bumpPluginVersion, incrementPatchVersion } from "../scripts/plugin-version.js"

const MARKETPLACE = `marketplace:
  name: example
plugins:
  base:
    version: 0.0.1
    description: Base
  plus:
    version: 1.2.3
    description: Plus
`

describe("plugin-version", () => {
  it("increments only the patch component", () => {
    expect(incrementPatchVersion("0.0.1")).toBe("0.0.2")
    expect(incrementPatchVersion("2.4.9")).toBe("2.4.10")
  })

  it("bumps only the selected plugin", () => {
    const result = bumpPluginVersion(MARKETPLACE, "plus")
    const parsed = parseYaml(result.content) as {
      plugins: Record<string, { version: string }>
    }

    expect(result.previousVersion).toBe("1.2.3")
    expect(result.nextVersion).toBe("1.2.4")
    expect(parsed.plugins.base!.version).toBe("0.0.1")
    expect(parsed.plugins.plus!.version).toBe("1.2.4")
  })

  it("rejects invalid or missing versions", () => {
    expect(() => incrementPatchVersion("v1")).toThrow("SemVer")
    expect(() => bumpPluginVersion(MARKETPLACE, "creative")).toThrow("不存在 plugin")
  })
})
