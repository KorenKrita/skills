import { describe, expect, it } from "vitest"
import { applyPatches, type Patch } from "../scripts/patch-engine.js"

const ZOOM_OUT_SKILL = `---
name: zoom-out
description: Tell the agent to zoom out and give broader context or a higher-level perspective.
disable-model-invocation: true
---

I don't know this area of code well. Go up a layer of abstraction. Give me a map of all the relevant modules and callers.
`

describe("patch-engine", () => {
  describe("remove_frontmatter", () => {
    it("removes an existing frontmatter field", () => {
      const { final, results } = applyPatches(ZOOM_OUT_SKILL, [
        { type: "remove_frontmatter", field: "disable-model-invocation" },
      ])
      expect(results[0]!.ok).toBe(true)
      expect(final).not.toContain("disable-model-invocation")
      expect(final).toContain("name: zoom-out")
    })

    it("reports failure when field does not exist", () => {
      const { results } = applyPatches(ZOOM_OUT_SKILL, [
        { type: "remove_frontmatter", field: "nonexistent-field" },
      ])
      expect(results[0]!.ok).toBe(false)
    })
  })

  describe("set_frontmatter", () => {
    it("sets an existing field to a new value", () => {
      const { final, results } = applyPatches(ZOOM_OUT_SKILL, [
        { type: "set_frontmatter", field: "disable-model-invocation", value: false },
      ])
      expect(results[0]!.ok).toBe(true)
      expect(final).toContain("disable-model-invocation: false")
    })

    it("adds a new field if it does not exist", () => {
      const { final, results } = applyPatches(ZOOM_OUT_SKILL, [
        { type: "set_frontmatter", field: "new-field", value: "hello" },
      ])
      expect(results[0]!.ok).toBe(true)
      expect(final).toContain("new-field: hello")
    })
  })

  describe("replace", () => {
    it("replaces matching text in body", () => {
      const { final, results } = applyPatches(ZOOM_OUT_SKILL, [
        { type: "replace", pattern: "Go up a layer of abstraction.", with: "向上抽象一层。" },
      ])
      expect(results[0]!.ok).toBe(true)
      expect(final).toContain("向上抽象一层。")
      expect(final).not.toContain("Go up a layer of abstraction.")
    })

    it("fails when pattern not found", () => {
      const { results } = applyPatches(ZOOM_OUT_SKILL, [
        { type: "replace", pattern: "text that does not exist", with: "x" },
      ])
      expect(results[0]!.ok).toBe(false)
    })
  })

  describe("replace_all", () => {
    it("replaces every match across frontmatter and body", () => {
      const source =
        ZOOM_OUT_SKILL.replace("description: Tell the agent", "description: zoom-out tells the agent") +
        "\nInvoke zoom-out again.\n"
      const { final, results } = applyPatches(source, [
        { type: "replace_all", pattern: "zoom-out", with: "broader-context" },
      ])
      expect(results[0]!.ok).toBe(true)
      expect(final).not.toContain("zoom-out")
      expect(final.match(/broader-context/g)).toHaveLength(3)
    })

    it("fails when pattern does not exist", () => {
      const { results } = applyPatches(ZOOM_OUT_SKILL, [
        { type: "replace_all", pattern: "missing-pattern", with: "x" },
      ])
      expect(results[0]!.ok).toBe(false)
    })
  })

  describe("append_content", () => {
    it("appends text to end of body and normalizes trailing newlines", () => {
      const { final, results } = applyPatches(ZOOM_OUT_SKILL, [
        { type: "append_content", text: "## 额外说明\n\n追加内容。\n" },
      ])
      expect(results[0]!.ok).toBe(true)
      expect(final).toMatch(/追加内容。\n$/)
      expect(final).not.toMatch(/追加内容。\n\n$/)
    })
  })

  describe("combined patches", () => {
    it("continues applying remaining patches after a failure", () => {
      const patches: Patch[] = [
        { type: "remove_frontmatter", field: "disable-model-invocation" },
        { type: "replace", pattern: "nonexistent text", with: "x" },
        { type: "append_content", text: "## 追加" },
      ]
      const { final, results } = applyPatches(ZOOM_OUT_SKILL, patches)
      expect(results[0]!.ok).toBe(true)
      expect(results[1]!.ok).toBe(false)
      expect(results[2]!.ok).toBe(true)
      expect(final).not.toContain("disable-model-invocation")
      expect(final).toContain("## 追加")
    })
  })
})
