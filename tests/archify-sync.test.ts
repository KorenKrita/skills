import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { parse as parseYaml } from "yaml"
import { applyPatches, type Patch } from "../scripts/patch-engine.js"
import { isExcludedFile } from "../scripts/sync-utils.js"

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf-8")

// Unmodified upstream manifest from tt-a1i/archify at a07fa1d5b2a1 (PR #221).
// Keep the fixture independent of overrides so stale exact-match patches fail.
const upstream = read("./fixtures/archify-a07fa1d.package.json")
const config = parseYaml(read("../overrides.yaml")) as {
  skills: { archify: { patches: Patch[]; exclude_files: string[]; target_patches: { target: string; patches: Patch[] }[] } }
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

  it("preserves the local discovery description without altering the skill body", async () => {
    const description = "Create professional architecture, workflow, sequence, data-flow, and lifecycle/state diagrams as explorable standalone HTML with SVG, pan/zoom, search, semantic relationship inspection, presentation mode, dark/light themes, optional motion, and PNG/JPEG/WebP/SVG/WebM export. Accepts plain-language descriptions or Mermaid flowchart, sequenceDiagram, and stateDiagram input, then lays diagrams out in Archify style. Use when the user asks for system or cloud architecture, infrastructure and network topology, security boundaries, technical or approval workflows, runbooks, CI/CD flows, API call sequences, request lifecycles, data pipelines, ETL/ELT, PII boundaries, data lineage, state machines, lifecycle/status transitions, or conversion/beautification of Mermaid diagrams."
    const source = "---\nname: archify\ndescription: upstream description\nlicense: MIT\n---\n\n# Archify\n"
    const result = await Effect.runPromise(applyPatches(source, config.skills.archify.patches))
    expect(result.results.filter(r => !r.ok)).toEqual([])
    expect(result.final).toBe(source.replace("description: upstream description", `description: ${description}`))
    const published = read("../plugins/plus/skills/archify/SKILL.md")
    expect(parseYaml(published.split("---\n")[1]!).description).toBe(description)
  })

  it("keeps schema documentation pointing to the shipped validator command", async () => {
    const patches = config.skills.archify.target_patches.find(p => p.target === "schemas/README.md")?.patches ?? []
    const source = "Run `npm test` to validate schemas.\n"
    const result = await Effect.runPromise(applyPatches(source, patches))
    expect(result.results.filter(r => !r.ok)).toEqual([])
    expect(result.final).toBe("Run `npm run check:validators` to validate schemas.\n")
    const published = read("../plugins/plus/skills/archify/schemas/README.md")
    expect(published).toContain("`npm run check:validators`")
    expect(published).not.toContain("`npm test`")
  })

  it("excludes upstream rendered examples and tests while retaining runtime assets", () => {
    // Independent contract: an empty exclusion list must not vacuously pass.
    const excluded = [
      "examples/dataflow-product-analytics.html",
      "examples/lifecycle-agent-run.html",
      "examples/sequence-cache-miss-request.html",
      "examples/web-app-rendered.html",
      "examples/workflow-agent-tool-call-rendered.html",
      "test/",
    ]
    expect(config.skills.archify.exclude_files).toEqual(excluded)
    const input = [
      ...excluded.slice(0, -1), "test/golden.mjs", "test/nested/example.mjs",
      "assets/template.html", "bin/archify.mjs", "examples/agent-tool-call.workflow.json",
      "scripts/check-render-output.mjs",
    ]
    expect(input.filter(file => !isExcludedFile(file, config.skills.archify.exclude_files))).toEqual([
      "assets/template.html", "bin/archify.mjs", "examples/agent-tool-call.workflow.json",
      "scripts/check-render-output.mjs",
    ])
  })
})
