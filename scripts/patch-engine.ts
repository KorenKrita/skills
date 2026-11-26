export type Patch =
  | { readonly type: "remove_frontmatter"; readonly field: string }
  | { readonly type: "set_frontmatter"; readonly field: string; readonly value: string | boolean | number }
  | { readonly type: "replace"; readonly pattern: string; readonly with: string }
  | { readonly type: "replace_all"; readonly pattern: string; readonly with: string }
  | { readonly type: "append_content"; readonly text: string }

export interface PatchResult {
  readonly patch: Patch
  readonly ok: boolean
  readonly msg: string
}

export interface ApplyPatchesResult {
  readonly final: string
  readonly results: readonly PatchResult[]
}

interface FrontmatterField {
  readonly key: string
  readonly raw: string
}

interface ParsedSkill {
  readonly hasFrontmatter: boolean
  readonly fields: FrontmatterField[]
  readonly body: string
}

function parseFrontmatter(content: string): ParsedSkill {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { hasFrontmatter: false, fields: [], body: content }

  const fields: FrontmatterField[] = []
  for (const line of match[1]!.split(/\r?\n/)) {
    const keyMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/)
    if (keyMatch) {
      fields.push({ key: keyMatch[1]!, raw: line })
    } else if (fields.length > 0) {
      const prev = fields[fields.length - 1]!
      fields[fields.length - 1] = { key: prev.key, raw: `${prev.raw}\n${line}` }
    }
  }

  return { hasFrontmatter: true, fields, body: match[2]! }
}

function formatValue(value: string | boolean | number): string {
  if (typeof value !== "string") return String(value)
  if (/[:#\n"'[\]{},&*?|<>=!%@`]/.test(value)) {
    return JSON.stringify(value)
  }
  return value
}

function reassemble(fields: FrontmatterField[], body: string): string {
  const fm = fields.map((f) => f.raw).join("\n")
  return `---\n${fm}\n---\n${body}`
}

function describePatch(patch: Patch): string {
  switch (patch.type) {
    case "remove_frontmatter":
      return `已移除字段 ${patch.field}`
    case "set_frontmatter":
      return `已设置 ${patch.field} = ${patch.value}`
    case "replace":
      return "已替换匹配内容"
    case "replace_all":
      return "已全部替换匹配内容"
    case "append_content":
      return "已追加内容"
  }
}

function applySingle(content: string, patch: Patch): { ok: true; output: string } | { ok: false; msg: string } {
  const { fields, body } = parseFrontmatter(content)

  switch (patch.type) {
    case "remove_frontmatter": {
      const next = fields.filter((f) => f.key !== patch.field)
      if (next.length === fields.length) {
        return { ok: false, msg: `frontmatter 字段 "${patch.field}" 不存在` }
      }
      return { ok: true, output: reassemble(next, body) }
    }

    case "set_frontmatter": {
      const newRaw = `${patch.field}: ${formatValue(patch.value)}`
      const idx = fields.findIndex((f) => f.key === patch.field)
      const next =
        idx === -1
          ? [...fields, { key: patch.field, raw: newRaw }]
          : fields.map((f, i) => (i === idx ? { key: patch.field, raw: newRaw } : f))
      return { ok: true, output: reassemble(next, body) }
    }

    case "replace": {
      if (!body.includes(patch.pattern)) {
        return { ok: false, msg: `未找到匹配文本 "${patch.pattern.slice(0, 60)}"` }
      }
      return { ok: true, output: reassemble(fields, body.replace(patch.pattern, patch.with)) }
    }

    case "replace_all": {
      if (!content.includes(patch.pattern)) {
        return { ok: false, msg: `未找到匹配文本 "${patch.pattern.slice(0, 60)}"` }
      }
      return { ok: true, output: content.split(patch.pattern).join(patch.with) }
    }

    case "append_content": {
      const normalized = patch.text.replace(/\n+$/, "")
      return { ok: true, output: reassemble(fields, `${body.trimEnd()}\n\n${normalized}\n`) }
    }
  }
}

export function applyPatches(content: string, patches: readonly Patch[]): ApplyPatchesResult {
  const results: PatchResult[] = []
  let current = content

  for (const patch of patches) {
    const res = applySingle(current, patch)
    if (res.ok) {
      current = res.output
      results.push({ patch, ok: true, msg: describePatch(patch) })
    } else {
      results.push({ patch, ok: false, msg: res.msg })
    }
  }

  return { final: current, results }
}
