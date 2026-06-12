import { Effect } from "effect"
import { execSync } from "node:child_process"
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from "node:fs"
import { join } from "node:path"
import { parse as parseYaml } from "yaml"
import { applyPatches, type Patch } from "./patch-engine.js"

// ─── Types ───────────────────────────────────────────────────────────────────

interface OverridesConfig {
  skills: Record<string, SkillOverride>
}

interface ExtraMapping {
  from: string
  to: string
}

interface SkillOverride {
  source: {
    repo: string
    path: string
    ref: string
  }
  plugin: string
  patches: Patch[]
  extra_mappings?: ExtraMapping[]
}

interface SyncState {
  [skillName: string]: { sha: string }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "")
const SYNC_STATE_PATH = join(ROOT, ".sync-state.json")
const OVERRIDES_PATH = join(ROOT, "overrides.yaml")

// ─── Helpers ─────────────────────────────────────────────────────────────────

function exec(cmd: string): string {
  return execSync(cmd, { encoding: "utf-8", cwd: ROOT }).trim()
}

function readSyncState(): SyncState {
  if (!existsSync(SYNC_STATE_PATH)) return {}
  return JSON.parse(readFileSync(SYNC_STATE_PATH, "utf-8"))
}

function writeSyncState(state: SyncState): void {
  writeFileSync(SYNC_STATE_PATH, JSON.stringify(state, null, 2) + "\n")
}

function readOverrides(): OverridesConfig {
  return parseYaml(readFileSync(OVERRIDES_PATH, "utf-8")) as OverridesConfig
}

function getUpstreamLatestSha(repo: string, ref: string): string | null {
  try {
    const result = exec(
      `git ls-remote https://github.com/${repo}.git refs/heads/${ref}`,
    )
    const sha = result.split("\t")[0]
    return sha || null
  } catch {
    return null
  }
}

function cloneUpstream(repo: string, ref: string, paths: string[]): string {
  const tempDir = join(ROOT, ".tmp-upstream")
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true })

  exec(`git clone --depth 1 --branch ${ref} --filter=blob:none --sparse https://github.com/${repo}.git ${tempDir}`)
  exec(`git -C ${tempDir} sparse-checkout set ${paths.join(" ")}`)
  exec(`git -C ${tempDir} checkout`)

  return tempDir
}

function copyTreeToDir(srcDir: string, destDir: string): string[] {
  if (!existsSync(srcDir)) return []

  const files = collectFiles(srcDir)
  mkdirSync(destDir, { recursive: true })

  for (const file of files) {
    const srcPath = join(srcDir, file)
    const destPath = join(destDir, file)
    mkdirSync(join(destPath, ".."), { recursive: true })
    writeFileSync(destPath, readFileSync(srcPath))
  }

  return files
}

function fetchUpstreamFiles(repo: string, ref: string, path: string, destDir: string, extraMappings?: ExtraMapping[]): string[] {
  const allPaths = [path, ...(extraMappings ?? []).map(m => m.from)]
  const tempDir = cloneUpstream(repo, ref, allPaths)

  const srcDir = join(tempDir, path)
  const files = copyTreeToDir(srcDir, destDir)

  if (extraMappings) {
    for (const mapping of extraMappings) {
      const src = join(tempDir, mapping.from)
      if (!existsSync(src)) continue
      const dest = join(ROOT, "plugins", mapping.to)
      mkdirSync(join(dest, ".."), { recursive: true })
      writeFileSync(dest, readFileSync(src))
    }
  }

  rmSync(tempDir, { recursive: true })
  return files
}

function collectFiles(dir: string, prefix = ""): string[] {
  const result: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const rel = prefix ? `${prefix}/${entry}` : entry
    if (statSync(full).isDirectory()) {
      result.push(...collectFiles(full, rel))
    } else {
      result.push(rel)
    }
  }
  return result
}

function getExistingFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return collectFiles(dir)
}

// ─── PR Creation ─────────────────────────────────────────────────────────────

function ensureLabels(labels: string[]): void {
  for (const label of labels) {
    try {
      exec(`gh label create "${label}" --force 2>/dev/null || true`)
    } catch {
      // already exists
    }
  }
}

type PrResult = "created" | "no-changes" | "branch-exists"

function createPr(
  skillName: string,
  repo: string,
  branch: string,
  isDraft: boolean,
  body: string,
): PrResult {
  const title = isDraft
    ? `同步：更新 ${skillName}（来自 ${repo}）[补丁失败]`
    : `同步：更新 ${skillName}（来自 ${repo}）`

  const labelList = isDraft ? ["自动同步", "补丁失败"] : ["自动同步"]

  try {
    exec(`git ls-remote --exit-code origin refs/heads/${branch}`)
    return "branch-exists"
  } catch {
    // branch doesn't exist on remote — proceed
  }

  exec(`git checkout -b ${branch}`)
  exec(`git add -A`)

  const status = exec(`git status --porcelain`)
  if (!status) {
    exec(`git checkout main`)
    return "no-changes"
  }

  exec(`git -c user.name="github-actions" -c user.email="actions@github.com" commit -m "同步：更新 ${skillName}"`)
  exec(`git push -u origin ${branch}`)

  const bodyFile = join(ROOT, ".tmp-pr-body.md")
  writeFileSync(bodyFile, body)

  ensureLabels(labelList)

  const draftFlag = isDraft ? "--draft" : ""
  const labelFlag = labelList.map(l => `--label "${l}"`).join(" ")
  exec(`gh pr create --title "${title}" --body-file "${bodyFile}" ${labelFlag} ${draftFlag}`)

  rmSync(bodyFile, { force: true })
  exec(`git checkout main`)
  return "created"
}

// ─── Main Sync Logic ─────────────────────────────────────────────────────────

const program = Effect.gen(function* () {
  const overrides = readOverrides()
  const syncState = readSyncState()
  let updated = false

  for (const [skillName, config] of Object.entries(overrides.skills)) {
    const { source, plugin, patches, extra_mappings } = config
    const latestSha = getUpstreamLatestSha(source.repo, source.ref)

    if (!latestSha) {
      console.log(`⚠️  ${skillName}: 无法获取上游 SHA，跳过`)
      continue
    }

    const lastSha = syncState[skillName]?.sha
    if (lastSha === latestSha) {
      console.log(`✓ ${skillName}: 无变更`)
      continue
    }

    console.log(`🔄 ${skillName}: 检测到上游更新 (${lastSha?.slice(0, 7) ?? "首次"} → ${latestSha.slice(0, 7)})`)

    const destDir = join(ROOT, "plugins", plugin, "skills", skillName)
    const existingLocalFiles = getExistingFiles(destDir)
    const upstreamFiles = fetchUpstreamFiles(source.repo, source.ref, source.path, destDir, extra_mappings)

    if (upstreamFiles.length === 0) {
      console.log(`⚠️  ${skillName}: 上游路径为空，跳过`)
      continue
    }

    // Check for name conflicts (upstream new file collides with local file)
    const localOnlyFiles = existingLocalFiles.filter((f) => !upstreamFiles.includes(f))
    const newUpstreamFiles = upstreamFiles.filter((f) => !existingLocalFiles.includes(f))
    const conflicts = newUpstreamFiles.filter((f) => localOnlyFiles.includes(f))

    // Apply patches to SKILL.md
    let patchFailed = false
    let patchReport = ""

    if (patches.length > 0) {
      const skillMdPath = join(destDir, "SKILL.md")
      if (existsSync(skillMdPath)) {
        const content = readFileSync(skillMdPath, "utf-8")
        const { final, results } = yield* applyPatches(content, patches)
        writeFileSync(skillMdPath, final)

        const failures = results.filter((r) => !r.ok)
        if (failures.length > 0) {
          patchFailed = true
          patchReport = failures
            .map((f) => `- ❌ [${f.patch.type}] ${f.msg}`)
            .join("\n")
        }

        const successes = results.filter((r) => r.ok)
        if (successes.length > 0) {
          patchReport =
            successes.map((s) => `- ✅ [${s.patch.type}] ${s.msg}`).join("\n") +
            (patchReport ? "\n" + patchReport : "")
        }
      }
    }

    // Build PR body
    let body = `## 上游变更\n\n`
    body += `- 来源: \`${source.repo}\` / \`${source.path}\`\n`
    body += `- 分支: \`${source.ref}\`\n`
    body += `- SHA: \`${latestSha.slice(0, 12)}\`\n`
    body += `- 文件: ${upstreamFiles.join(", ")}\n`

    if (patches.length > 0) {
      body += `\n## 补丁结果\n\n${patchReport}\n`
    }

    if (conflicts.length > 0) {
      body += `\n## ⚠️ 文件名冲突\n\n`
      body += `以下上游新增文件与本地文件同名，需手动处理：\n`
      body += conflicts.map((f) => `- \`${f}\``).join("\n") + "\n"
      patchFailed = true
    }

    // Create PR
    const branch = `sync/${skillName}-${latestSha.slice(0, 7)}`

    try {
      const result = createPr(skillName, source.repo, branch, patchFailed, body)
      if (result === "created") {
        console.log(`  📬 PR 已创建${patchFailed ? " (Draft)" : ""}`)
        syncState[skillName] = { sha: latestSha }
        updated = true
      } else if (result === "no-changes") {
        console.log(`  ⏭️  ${skillName}: 文件内容无变化，跳过`)
      } else {
        console.log(`  ⏭️  ${skillName}: 分支已存在，跳过`)
      }
    } catch (e) {
      console.log(`  ❌ PR 创建失败: ${e}`)
    }
  }

  if (updated) {
    writeSyncState(syncState)
  }

  // Rebuild marketplace.json
  exec(`npx tsx scripts/build-marketplace.ts`)
  console.log("\n✅ 同步完成")
})

Effect.runPromise(program).catch((e) => {
  console.error("同步失败:", e)
  process.exit(1)
})
