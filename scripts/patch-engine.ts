import { Data, Effect } from "effect"

// ─── Domain Types ────────────────────────────────────────────────────────────

export type Patch =
  | { readonly type: "remove_frontmatter"; readonly field: string }
  | { readonly type: "set_frontmatter"; readonly field: string; readonly value: string | boolean | number }
  | { readonly type: "append_to_frontmatter"; readonly field: string; readonly text: string }
  | { readonly type: "replace"; readonly pattern: string; readonly with: string }
  | { readonly type: "replace_all"; readonly pattern: string; readonly with: string }
  | { readonly type: "append_content"; readonly text: string }

export interface PatchResult {
  readonly patch: Patch
  readonly ok: boolean
  readonly msg: string
}

export class PatchFailure extends Data.TaggedError("PatchFailure")<{
  readonly patch: Patch
  readonly msg: string
}> {}

interface FrontmatterField {
  readonly key: string
  readonly raw: string
}

interface ParsedSkill {
  readonly fields: FrontmatterField[]
  readonly body: string
}

// ─── Frontmatter Parsing ─────────────────────────────────────────────────────

function parseFrontmatter(content: string): ParsedSkill {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { fields: [], body: content }
  const rawLines = match[1]!.split("\n")
  const fields: FrontmatterField[] = []
  for (const line of rawLines) {
    const colonIdx = line.indexOf(":")
    if (colonIdx === -1) {
      if (fields.length > 0) {
        fields[fields.length - 1] = {
          ...fields[fields.length - 1]!,
          raw: fields[fields.length - 1]!.raw + "\n" + line,
        }
      }
      continue
    }
    fields.push({ key: line.slice(0, colonIdx).trim(), raw: line })
  }
  return { fields, body: match[2]! }
}

function getFieldValue(field: FrontmatterField): string {
  const colonIdx = field.raw.indexOf(":")
  const valuePart = field.raw.slice(colonIdx + 1).trim()
  if (valuePart.startsWith('"') && valuePart.endsWith('"')) return valuePart.slice(1, -1)
  return valuePart
}

function formatValue(value: string | boolean | number): string {
  if (typeof value === "boolean" || typeof value === "number") return String(value)
  if (value.includes(":") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '\\"')}"`
  }
  return value
}

function reassemble(fields: FrontmatterField[], body: string): string {
  const fm = fields.map((f) => f.raw).join("\n")
  return `---\n${fm}\n---\n${body}`
}

// ─── Patch Application (single) ─────────────────────────────────────────────

function applySingle(content: string, patch: Patch): Effect.Effect<string, PatchFailure> {
  const { fields, body } = parseFrontmatter(content)

  switch (patch.type) {
    case "remove_frontmatter": {
      const idx = fields.findIndex((f) => f.key === patch.field)
      if (idx === -1) {
        return new PatchFailure({ patch, msg: `字段 "${patch.field}" 不存在` })
      }
      const newFields = [...fields.slice(0, idx), ...fields.slice(idx + 1)]
      return Effect.succeed(reassemble(newFields, body))
    }

    case "set_frontmatter": {
      const idx = fields.findIndex((f) => f.key === patch.field)
      const formatted = formatValue(patch.value)
      const newRaw = `${patch.field}: ${formatted}`
      if (idx === -1) {
        return Effect.succeed(reassemble([...fields, { key: patch.field, raw: newRaw }], body))
      }
      const newFields = fields.map((f, i) => (i === idx ? { key: patch.field, raw: newRaw } : f))
      return Effect.succeed(reassemble(newFields, body))
    }

    case "append_to_frontmatter": {
      const idx = fields.findIndex((f) => f.key === patch.field)
      if (idx === -1) {
        return new PatchFailure({ patch, msg: `字段 "${patch.field}" 不存在` })
      }
      const current = getFieldValue(fields[idx]!)
      const newValue = current + patch.text
      const formatted = formatValue(newValue)
      const newRaw = `${patch.field}: ${formatted}`
      const newFields = fields.map((f, i) => (i === idx ? { key: patch.field, raw: newRaw } : f))
      return Effect.succeed(reassemble(newFields, body))
    }

    case "replace": {
      if (!body.includes(patch.pattern)) {
        return new PatchFailure({ patch, msg: `未找到匹配: "${patch.pattern.slice(0, 50)}"` })
      }
      const newBody = body.replace(patch.pattern, patch.with)
      return Effect.succeed(reassemble(fields, newBody))
    }

    case "replace_all": {
      if (!content.includes(patch.pattern)) {
        return new PatchFailure({ patch, msg: `未找到匹配: "${patch.pattern.slice(0, 50)}"` })
      }
      return Effect.succeed(content.split(patch.pattern).join(patch.with))
    }

    case "append_content": {
      const newBody = body.trimEnd() + "\n\n" + patch.text + "\n"
      return Effect.succeed(reassemble(fields, newBody))
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface ApplyPatchesResult {
  readonly final: string
  readonly results: PatchResult[]
}

export const applyPatches = (
  content: string,
  patches: readonly Patch[],
): Effect.Effect<ApplyPatchesResult> =>
  Effect.gen(function* () {
    let current = content
    const results: PatchResult[] = []

    for (const patch of patches) {
      const result = yield* applySingle(current, patch).pipe(
        Effect.map((output): PatchResult & { output: string } => ({
          patch,
          ok: true,
          msg: patchMsg(patch),
          output,
        })),
        Effect.catchTag("PatchFailure", (err) =>
          Effect.succeed({ patch, ok: false, msg: err.msg, output: current }),
        ),
      )
      current = result.output
      results.push({ patch: result.patch, ok: result.ok, msg: result.msg })
    }

    return { final: current, results }
  })

function patchMsg(patch: Patch): string {
  switch (patch.type) {
    case "remove_frontmatter":
      return `删除字段 ${patch.field}`
    case "set_frontmatter":
      return `设置 ${patch.field} = ${patch.value}`
    case "append_to_frontmatter":
      return `追加到 ${patch.field}`
    case "replace":
      return `替换成功`
    case "replace_all":
      return `全部替换成功`
    case "append_content":
      return `正文末尾追加 ${patch.text.length} 字符`
  }
}
