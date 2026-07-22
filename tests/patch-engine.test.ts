import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { applyPatches, type Patch } from "../scripts/patch-engine.js"

const ZOOM_OUT_SKILL = `---
name: zoom-out
description: Tell the agent to zoom out and give broader context or a higher-level perspective. Use when you're unfamiliar with a section of code or need to understand how it fits into the bigger picture.
disable-model-invocation: true
---

I don't know this area of code well. Go up a layer of abstraction. Give me a map of all the relevant modules and callers, using the project's domain glossary vocabulary.
`

describe("patch-engine", () => {
  describe("remove_frontmatter", () => {
    it.effect("removes an existing frontmatter field", () =>
      Effect.gen(function* () {
        const { final, results } = yield* applyPatches(ZOOM_OUT_SKILL, [
          { type: "remove_frontmatter", field: "disable-model-invocation" },
        ])
        expect(results[0]!.ok).toBe(true)
        expect(final).not.toContain("disable-model-invocation")
        expect(final).toContain("name: zoom-out")
        expect(final).toContain("description:")
      }),
    )

    it.effect("reports failure when field does not exist", () =>
      Effect.gen(function* () {
        const { results } = yield* applyPatches(ZOOM_OUT_SKILL, [
          { type: "remove_frontmatter", field: "nonexistent-field" },
        ])
        expect(results[0]!.ok).toBe(false)
      }),
    )
  })

  describe("set_frontmatter", () => {
    it.effect("sets an existing field to a new value", () =>
      Effect.gen(function* () {
        const { final, results } = yield* applyPatches(ZOOM_OUT_SKILL, [
          { type: "set_frontmatter", field: "disable-model-invocation", value: false },
        ])
        expect(results[0]!.ok).toBe(true)
        expect(final).toContain("disable-model-invocation: false")
      }),
    )

    it.effect("adds a new field if it does not exist", () =>
      Effect.gen(function* () {
        const { final, results } = yield* applyPatches(ZOOM_OUT_SKILL, [
          { type: "set_frontmatter", field: "new-field", value: "hello" },
        ])
        expect(results[0]!.ok).toBe(true)
        expect(final).toContain("new-field: hello")
      }),
    )
  })

  describe("append_to_frontmatter", () => {
    it.effect("appends text to an existing field", () =>
      Effect.gen(function* () {
        const { final, results } = yield* applyPatches(ZOOM_OUT_SKILL, [
          { type: "append_to_frontmatter", field: "description", text: " 也在用户说\"放大视角\"时触发。" },
        ])
        expect(results[0]!.ok).toBe(true)
        expect(final).toContain("放大视角")
      }),
    )

    it.effect("fails when field does not exist", () =>
      Effect.gen(function* () {
        const { results } = yield* applyPatches(ZOOM_OUT_SKILL, [
          { type: "append_to_frontmatter", field: "nonexistent", text: "nope" },
        ])
        expect(results[0]!.ok).toBe(false)
      }),
    )
  })

  describe("replace", () => {
    it.effect("replaces matching text in body", () =>
      Effect.gen(function* () {
        const { final, results } = yield* applyPatches(ZOOM_OUT_SKILL, [
          { type: "replace", pattern: "Go up a layer of abstraction.", with: "向上抽象一层。" },
        ])
        expect(results[0]!.ok).toBe(true)
        expect(final).toContain("向上抽象一层。")
        expect(final).not.toContain("Go up a layer of abstraction.")
      }),
    )

    it.effect("fails when pattern not found", () =>
      Effect.gen(function* () {
        const { results } = yield* applyPatches(ZOOM_OUT_SKILL, [
          { type: "replace", pattern: "text that does not exist", with: "x" },
        ])
        expect(results[0]!.ok).toBe(false)
      }),
    )
  })

  describe("replace_all", () => {
    it.effect("replaces every match across frontmatter and body", () =>
      Effect.gen(function* () {
        const source = ZOOM_OUT_SKILL.replace(
          "description: Tell the agent",
          "description: zoom-out tells the agent",
        ) + "\nInvoke zoom-out again.\n"
        const { final, results } = yield* applyPatches(source, [
          { type: "replace_all", pattern: "zoom-out", with: "broader-context" },
        ])
        expect(results[0]!.ok).toBe(true)
        expect(final).not.toContain("zoom-out")
        expect(final.match(/broader-context/g)).toHaveLength(3)
      }),
    )

    it.effect("fails when pattern does not exist", () =>
      Effect.gen(function* () {
        const { results } = yield* applyPatches(ZOOM_OUT_SKILL, [
          { type: "replace_all", pattern: "missing-pattern", with: "x" },
        ])
        expect(results[0]!.ok).toBe(false)
      }),
    )
  })

  describe("append_content", () => {
    it.effect("appends text to end of body", () =>
      Effect.gen(function* () {
        const { final, results } = yield* applyPatches(ZOOM_OUT_SKILL, [
          { type: "append_content", text: "## 额外说明\n\n追加内容。" },
        ])
        expect(results[0]!.ok).toBe(true)
        expect(final).toContain("## 额外说明")
        expect(final.trimEnd()).toMatch(/追加内容。$/)
      }),
    )

    it.effect("normalizes trailing newlines from YAML block scalars", () =>
      Effect.gen(function* () {
        const { final } = yield* applyPatches(ZOOM_OUT_SKILL, [
          { type: "append_content", text: "## 额外说明\n\n追加内容。\n" },
        ])
        expect(final).toMatch(/追加内容。\n$/)
        expect(final).not.toMatch(/追加内容。\n\n$/)
      }),
    )
  })

  describe("combined patches", () => {
    it.effect("applies multiple patches in sequence", () =>
      Effect.gen(function* () {
        const patches: Patch[] = [
          { type: "remove_frontmatter", field: "disable-model-invocation" },
          { type: "append_to_frontmatter", field: "description", text: " 放大视角。" },
          { type: "append_content", text: "## 补充\n\n额外内容。" },
        ]
        const { final, results } = yield* applyPatches(ZOOM_OUT_SKILL, patches)
        expect(results.filter((r) => r.ok).length).toBe(3)
        expect(final).not.toContain("disable-model-invocation")
        expect(final).toContain("放大视角")
        expect(final).toContain("## 补充")
      }),
    )

    it.effect("continues after a failure", () =>
      Effect.gen(function* () {
        const patches: Patch[] = [
          { type: "remove_frontmatter", field: "disable-model-invocation" },
          { type: "replace", pattern: "nonexistent text", with: "x" },
          { type: "append_content", text: "## 追加" },
        ]
        const { final, results } = yield* applyPatches(ZOOM_OUT_SKILL, patches)
        expect(results[0]!.ok).toBe(true)
        expect(results[1]!.ok).toBe(false)
        expect(results[2]!.ok).toBe(true)
        expect(final).not.toContain("disable-model-invocation")
        expect(final).toContain("## 追加")
      }),
    )
  })
})
