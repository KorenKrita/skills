import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { parse as parseYaml } from "yaml"
import { applyPatches, type Patch } from "../scripts/patch-engine.js"

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf-8")

// Unmodified upstream manifest from tt-a1i/archify at a07fa1d5b2a1 (PR #221).
// Keep the fixture independent of overrides so stale exact-match patches fail.
const upstream = read("./fixtures/archify-a07fa1d.package.json")
const config = parseYaml(read("../overrides.yaml")) as {
  skills: { archify: { target_patches: { target: string; patches: Patch[] }[] } }
}
const patches = config.skills.archify.target_patches.find(p => p.target === "package.json")!.patches

describe("Archify sync patches", () => {
  it("applies every patch to the upstream manifest and reproduces the published payload", async () => {
    const result = await Effect.runPromise(applyPatches(upstream, patches))
    expect(result.results.filter(r => !r.ok)).toEqual([])
    expect(result.final).toBe(read("../plugins/plus/skills/archify/package.json"))
    const original = JSON.parse(upstream)
    const actual = JSON.parse(result.final)
    const { scripts: _, ...metadata } = original
    const { scripts, ...actualMetadata } = actual
    expect(actualMetadata).toEqual(metadata)
    expect(scripts).toEqual(Object.fromEntries(
      ["generate:brand-marks", "check:brand-marks", "generate:validators", "check:validators"]
        .map(key => [key, original.scripts[key]]),
    ))
  })
})
