import { Effect } from "effect"
import { execSync } from "node:child_process"
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from "node:fs"
import { join } from "node:path"
import { parse as parseYaml } from "yaml"
import { applyPatches, type Patch } from "./patch-engine.js"
import {
  copyFilePreservingMode,
  findNewFileConflicts,
  findOrphanedStateKeys,
  findRemovedFiles,
  planSparseCheckout,
} from "./sync-utils.js"

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
  patch_targets?: string[]
  extra_mappings?: ExtraMapping[]
}

interface SyncStateEntry {
  sha: string
  files?: string[]
}

interface SyncState {
  [skillName: string]: SyncStateEntry
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "")
const SYNC_STATE_PATH = join(ROOT, ".sync-state.json")
const OVERRIDES_PATH = join(ROOT, "overrides.yaml")
const FORCE_SYNC = process.argv.includes("--force")

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

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function cloneUpstream(repo: string, ref: string, paths: string[]): string {
  const tempDir = join(ROOT, ".tmp-upstream")
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true })

  const plan = planSparseCheckout(paths)
  exec(`git clone --depth 1 --branch ${shellQuote(ref)} --filter=blob:none --sparse https://github.com/${repo}.git ${shellQuote(tempDir)}`)
  if (plan.checkoutWholeRepo) {
    exec(`git -C ${shellQuote(tempDir)} sparse-checkout disable`)
  } else {
    const directories = plan.directories.map(shellQuote).join(" ")
    exec(`git -C ${shellQuote(tempDir)} sparse-checkout set -- ${directories}`)
  }
  exec(`git -C ${shellQuote(tempDir)} checkout`)

  return tempDir
}

function copyTreeToDir(srcDir: string, destDir: string): string[] {
  if (!existsSync(srcDir)) return []

  const files = collectFiles(srcDir)
  mkdirSync(destDir, { recursive: true })

  for (const file of files) {
    copyFilePreservingMode(join(srcDir, file), join(destDir, file))
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
      const dest = join(ROOT, mapping.to)
      copyFilePreservingMode(src, dest)
    }
  }

  rmSync(tempDir, { recursive: true })
  return files
}

const SKIP_DIRS = new Set([".git", "node_modules"])

function collectFiles(dir: string, prefix = ""): string[] {
  const result: string[] = []
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
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

function removeDeletedUpstreamFiles(
  destDir: string,
  previousUpstreamFiles: readonly string[] | undefined,
  currentUpstreamFiles: readonly string[],
): string[] {
  if (!previousUpstreamFiles) return []

  const removedFiles = findRemovedFiles(previousUpstreamFiles, currentUpstreamFiles)
  for (const file of removedFiles) {
    const target = join(destDir, file)
    rmSync(target, { force: true })
  }
  return removedFiles
}

function cleanPaths(stagePaths: string[], forceAddPaths: string[] = []): void {
  for (const path of stagePaths) {
    try {
      exec(`git restore --staged --worktree -- ${shellQuote(path)}`)
    } catch {
      // The path may only contain newly created, untracked files.
    }
    try {
      exec(`git clean -fd -- ${shellQuote(path)}`)
    } catch {
      // Best-effort cleanup; exact ignored files are handled below.
    }
  }

  for (const path of forceAddPaths) {
    try {
      exec(`git clean -fdx -- ${shellQuote(path)}`)
    } catch {
      // The file may be tracked on main or may already have been removed.
    }
  }
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

function remoteBranchExists(branch: string): boolean {
  try {
    exec(`git ls-remote --exit-code origin refs/heads/${shellQuote(branch)}`)
    return true
  } catch {
    return false
  }
}

function branchHasOpenPr(branch: string): boolean {
  const count = exec(
    `gh pr list --state open --head ${shellQuote(branch)} --json number --jq 'length'`,
  )
  return Number(count) > 0
}

function deleteLocalBranch(branch: string): void {
  try {
    exec(`git branch -D ${shellQuote(branch)}`)
  } catch {
    // The branch may not exist locally.
  }
}

function stageSyncChanges(stagePaths: string[], forceAddPaths: string[]): void {
  for (const path of stagePaths) {
    exec(`git add -A -- ${shellQuote(path)}`)
  }

  const chunkSize = 100
  for (let i = 0; i < forceAddPaths.length; i += chunkSize) {
    const chunk = forceAddPaths.slice(i, i + chunkSize).map(shellQuote).join(" ")
    exec(`git add -f -- ${chunk}`)
  }
}

function hasStagedChanges(): boolean {
  try {
    exec("git diff --cached --quiet")
    return false
  } catch {
    return true
  }
}

function createPr(
  skillName: string,
  repo: string,
  branch: string,
  isDraft: boolean,
  body: string,
  stagePaths: string[],
  forceAddPaths: string[],
): PrResult {
  const title = isDraft
    ? `同步：更新 ${skillName}（来自 ${repo}）[补丁失败]`
    : `同步：更新 ${skillName}（来自 ${repo}）`

  const labelList = isDraft ? ["自动同步", "补丁失败"] : ["自动同步"]

  if (remoteBranchExists(branch)) {
    if (branchHasOpenPr(branch)) return "branch-exists"
    console.log(`  🧹 ${skillName}: 删除没有 Open PR 的旧同步分支 ${branch}`)
    exec(`git push origin --delete ${shellQuote(branch)}`)
  }

  deleteLocalBranch(branch)
  exec(`git checkout -b ${shellQuote(branch)}`)
  stageSyncChanges(stagePaths, forceAddPaths)

  if (!hasStagedChanges()) {
    exec("git checkout main")
    deleteLocalBranch(branch)
    return "no-changes"
  }

  exec(`git -c user.name="github-actions" -c user.email="actions@github.com" commit -m "同步：更新 ${skillName}"`)
  exec(`git push -u origin ${shellQuote(branch)}`)

  const bodyFile = join(ROOT, ".tmp-pr-body.md")
  writeFileSync(bodyFile, body)

  ensureLabels(labelList)

  const draftFlag = isDraft ? "--draft" : ""
  const labelFlag = labelList.map(l => `--label "${l}"`).join(" ")
  exec(`gh pr create --title "${title}" --body-file "${bodyFile}" ${labelFlag} ${draftFlag}`)

  rmSync(bodyFile, { force: true })
  exec("git checkout main")
  deleteLocalBranch(branch)
  return "created"
}

// ─── Main Sync Logic ─────────────────────────────────────────────────────────

const program = Effect.gen(function* () {
  const overrides = readOverrides()
  const syncState = readSyncState()
  let updated = false

  const orphanedStateKeys = findOrphanedStateKeys(
    Object.keys(syncState),
    Object.keys(overrides.skills),
  )
  for (const skillName of orphanedStateKeys) {
    console.log(`🧹 ${skillName}: 从同步状态中移除已删除的配置`)
    delete syncState[skillName]
    updated = true
  }

  for (const [skillName, config] of Object.entries(overrides.skills)) {
    const { source, plugin, patches, patch_targets, extra_mappings } = config
    const latestSha = getUpstreamLatestSha(source.repo, source.ref)

    if (!latestSha) {
      console.log(`⚠️  ${skillName}: 无法获取上游 SHA，跳过`)
      continue
    }

    const previousState = syncState[skillName]
    const lastSha = previousState?.sha
    if (lastSha === latestSha && !FORCE_SYNC) {
      console.log(`✓ ${skillName}: 无变更`)
      continue
    }

    const reason = FORCE_SYNC && lastSha === latestSha ? "强制审计" : "检测到上游更新"
    console.log(`🔄 ${skillName}: ${reason} (${lastSha?.slice(0, 7) ?? "首次"} → ${latestSha.slice(0, 7)})`)

    const destDir = join(ROOT, "plugins", plugin, "skills", skillName)
    const existingLocalFiles = getExistingFiles(destDir)
    const upstreamFiles = fetchUpstreamFiles(source.repo, source.ref, source.path, destDir, extra_mappings)

    if (upstreamFiles.length === 0) {
      console.log(`⚠️  ${skillName}: 上游路径为空，跳过`)
      continue
    }

    const removedFiles = removeDeletedUpstreamFiles(
      destDir,
      previousState?.files,
      upstreamFiles,
    )

    // A conflict only exists when a file was local-only in the previous manifest
    // and is newly introduced by upstream. Existing upstream-managed files are
    // expected to be overwritten on every sync.
    const conflicts = findNewFileConflicts(
      existingLocalFiles,
      previousState?.files,
      upstreamFiles,
    )

    // Apply patches to SKILL.md
    let patchFailed = false
    let patchReport = ""

    if (patches.length > 0) {
      const reports: string[] = []
      for (const target of patch_targets ?? ["SKILL.md"]) {
        const patchPath = join(destDir, target)
        if (!existsSync(patchPath)) {
          patchFailed = true
          reports.push(`- ❌ [${target}] 补丁目标不存在`)
          continue
        }

        const content = readFileSync(patchPath, "utf-8")
        const { final, results } = yield* applyPatches(content, patches)
        writeFileSync(patchPath, final)

        for (const result of results) {
          if (!result.ok) patchFailed = true
          reports.push(
            `- ${result.ok ? "✅" : "❌"} [${target} / ${result.patch.type}] ${result.msg}`,
          )
        }
      }
      patchReport = reports.join("\n")
    }

    // Build PR body
    let body = `## 上游变更\n\n`
    body += `- 来源: \`${source.repo}\` / \`${source.path}\`\n`
    body += `- 分支: \`${source.ref}\`\n`
    body += `- SHA: \`${latestSha.slice(0, 12)}\`\n`
    body += `- 文件: ${upstreamFiles.join(", ")}\n`
    if (removedFiles.length > 0) {
      body += `- 上游已删除: ${removedFiles.join(", ")}\n`
    }

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
    const extraMappingPaths = (extra_mappings ?? []).map(m => join(ROOT, m.to))
    const stagePaths = [destDir, ...extraMappingPaths]
    const forceAddPaths = [
      ...upstreamFiles.map(file => join(destDir, file)),
      ...extraMappingPaths,
    ]

    try {
      const result = createPr(
        skillName,
        source.repo,
        branch,
        patchFailed,
        body,
        stagePaths,
        forceAddPaths,
      )
      if (result === "created") {
        console.log(`  📬 PR 已创建${patchFailed ? " (Draft)" : ""}`)
      } else if (result === "no-changes") {
        console.log(`  ⏭️  ${skillName}: 文件内容无变化，记录最新状态`)
      } else {
        console.log(`  ⏭️  ${skillName}: 分支已存在，记录最新状态`)
        cleanPaths(stagePaths, forceAddPaths)
      }

      syncState[skillName] = { sha: latestSha, files: upstreamFiles }
      updated = true
    } catch (e) {
      try {
        exec("git checkout main")
      } catch {
        // Already on main or checkout is blocked by an unexpected failure.
      }
      cleanPaths(stagePaths, forceAddPaths)
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
