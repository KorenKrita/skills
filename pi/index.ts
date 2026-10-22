import { existsSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { SETS, readEffectiveConfig, resolveEnabled, skillPathsFor, type SkillSet } from "./settings.js"

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const STATE_ENTRY = "skills-injection-state"

type SessionEntry = { type?: string; customType?: string; data?: { base?: unknown } }
type Ctx = {
  sessionManager?: { getEntries(): SessionEntry[] }
  ui?: { notify(message: string, level?: string): void }
  reload?(): Promise<void>
}
type PiApi = {
  on(event: string, handler: (event: unknown, ctx: Ctx) => unknown): void
  registerCommand(
    name: string,
    options: { description: string; handler: (arg: string, ctx: Ctx) => unknown },
  ): void
  appendEntry(customType: string, data?: unknown): void
}

/** This branch's `/matt on`, or undefined when the session never ran it. */
function readSessionBase(ctx: Ctx): boolean | undefined {
  try {
    const entries = ctx.sessionManager?.getEntries() ?? []
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i]
      if (entry?.customType === STATE_ENTRY || entry?.type === STATE_ENTRY) {
        return typeof entry.data?.base === "boolean" ? entry.data.base : undefined
      }
    }
  } catch {
    // A session that cannot be read falls back to the config defaults.
  }
  return undefined
}

function skillCount(set: SkillSet): number {
  const dir = join(packageRoot, "plugins", set, "skills")
  try {
    return readdirSync(dir, { withFileTypes: true }).filter(
      (entry) => entry.isDirectory() && existsSync(join(dir, entry.name, "SKILL.md")),
    ).length
  } catch {
    return 0
  }
}

function notify(ctx: Ctx, message: string): void {
  ctx.ui?.notify(message, "info")
}

export default function (pi: PiApi): void {
  // Skills are not listed in package.json; the config decides which sets load.
  pi.on("resources_discover", (_event, ctx) => {
    const enabled = resolveEnabled(readEffectiveConfig(packageRoot), readSessionBase(ctx))
    return { skillPaths: skillPathsFor(packageRoot, enabled) }
  })

  if (!readEffectiveConfig(packageRoot).mattCommand) return

  pi.registerCommand("matt", {
    description: "把 mattpocock 的 base 技能注入本会话（/matt on），或查看当前注入状态（/matt status）",
    handler: async (arg, ctx) => {
      const sub = (arg ?? "").trim().toLowerCase()
      const config = readEffectiveConfig(packageRoot)
      const sessionBase = readSessionBase(ctx)
      const enabled = resolveEnabled(config, sessionBase)

      if (sub === "status") {
        notify(
          ctx,
          [
            `技能注入（本会话）：base ${enabled.base ? "开" : "关"}｜plus ${enabled.plus ? "开" : "关"}`,
            `配置默认值：base ${config.defaults.base ? "开" : "关"}｜plus ${config.defaults.plus ? "开" : "关"}（${join(packageRoot, "pi.config.json")} + 用户覆盖）`,
            `本会话覆盖：${sessionBase === undefined ? "无" : `base ${sessionBase ? "开" : "关"}`}`,
            `技能数：base ${skillCount("base")} 份｜plus ${skillCount("plus")} 份`,
          ].join("\n"),
        )
        return
      }

      if (sub === "on") {
        try {
          pi.appendEntry(STATE_ENTRY, { base: true })
        } catch {
          // Without a session the entry cannot be stored; the reload still runs once.
        }
        notify(ctx, "base 技能已注入本会话，重载中")
        await ctx.reload?.()
        return
      }

      notify(ctx, "用法：/matt on（本会话注入 base 技能）｜/matt status（查看状态）")
    },
  })
}

export { SETS }
