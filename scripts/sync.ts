/**
 * Upstream sync script: check upstream repos -> pull files -> apply patches -> open PR per updated skill.
 * Usage: npx tsx scripts/sync.ts [--force]
 */
import { execSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parse as parseYaml } from "yaml"
import { applyPatches, type Patch } from "./patch-engine.js"
import { bumpPluginVersion } from "./plugin-version.js"
import {
  copyFilePreservingMode,
  findNewFileConflicts,
  findOpenSyncBranch,
  findOrphanedStateKeys,
  findRemovedFiles,
  planSync,
  syncStateAfterPr,
  syncStateForPrBranch,
  type SyncState,
  type SyncStateEntry,
} from "./sync-utils.js"

interface TargetPatchSet {
  target: string
  patches: Patch[]
}

interface SkillSource {
  repo: string
  path: string
  ref: string
}

interface UpstreamSkillConfig {
  ownership?: "upstream"
  source: SkillSource
  plugin: string
  patches: Patch[]
  target_patches?: TargetPatchSet[]
  exclude_files?: string[]
}

interface LocalSkillConfig {
  ownership: "local"
  plugin: string
}

type SkillConfig = UpstreamSkillConfig | LocalSkillConfig

interface Overrides {
  skills: Record<string, SkillConfig>
}

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "")
const SYNC_STATE_PATH = join(ROOT, ".sync-state.json")
const OVERRIDES_PATH = join(ROOT, "overrides.yaml")
const MARKETPLACE_CONFIG_PATH = join(ROOT, "marketplace.yaml")
const GENERATED_MANIFEST_PATHS = [
  join(ROOT, ".claude-plugin", "marketplace.json"),
  join(ROOT, ".cursor-plugin", "marketplace.json"),
  join(ROOT, ".agents", "plugins", "marketplace.json"),
  join(ROOT, "plugins", "*", ".cursor-plugin", "plugin.json"),
  join(ROOT, "plugins", "*", ".codex-plugin", "plugin.json"),
]
const FORCE_SYNC = process.argv.includes("--force")
const SKIP_DIRS = new Set([".git", "node_modules"])

function exec(cmd: string, cwd = ROOT): string {
  return execSync(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim()
}

function shellQuote(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`
}

function readSyncState(): Record<string, SyncStateEntry> {
  if (!existsSync(SYNC_STATE_PATH)) return {}
  return JSON.parse(readFileSync(SYNC_STATE_PATH, "utf-8")) as Record<string, SyncStateEntry>
}

function writeSyncState(state: SyncState): void {
  writeFileSync(SYNC_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`)
}

function readOverrides(): Overrides {
  return parseYaml(readFileSync(OVERRIDES_PATH, "utf-8")) as Overrides
}

function getUpstreamLatestSha(repo: string, ref: string): string | null {
  try {
    return exec(`gh api repos/${repo}/commits/${ref} --jq .sha`)
  } catch {
    return null
  }
}

function copyTreeToDir(srcDir: string, destDir: string, excludeFiles?: string[]): string[] {
  const files: string[] = []
  const excluded = new Set(excludeFiles ?? [])
  if (!existsSync(srcDir)) return files

  function walk(dir: string, relPrefix: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const rel = relPrefix ? `${relPrefix}/${entry}` : entry
      if (excluded.has(rel)) continue
      if (statSync(full).isDirectory()) {
        walk(full, rel)
      } else {
        copyFilePreservingMode(full, join(destDir, rel))
        files.push(rel)
      }
    }
  }

  walk(srcDir, "")
  return files.sort()
}

function fetchUpstreamFiles(
  repo: string,
  ref: string,
  path: string,
  destDir: string,
  excludeFiles?: string[],
): string[] {
  const tempDir = join(ROOT, `.tmp-sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  mkdirSync(tempDir, { recursive: true })
  try {
    exec(`git clone --depth 1 --branch ${shellQuote(ref)} --filter=blob:none --sparse https://github.com/${repo}.git .`, tempDir)
    exec(`git sparse-checkout set ${shellQuote(path)}`, tempDir)
    return copyTreeToDir(join(tempDir, path), destDir, excludeFiles)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

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
  return existsSync(dir) ? collectFiles(dir) : []
}

function removeDeletedUpstreamFiles(
  destDir: string,
  previousUpstreamFiles: readonly string[] | undefined,
  currentUpstreamFiles: readonly string[],
): string[] {
  if (!previousUpstreamFiles) return []
  const removed = findRemovedFiles(previousUpstreamFiles, currentUpstreamFiles)
  for (const file of removed) rmSync(join(destDir, file), { force: true })
  return removed
}

function cleanPaths(stagePaths: string[], forceAddPaths: string[] = []): void {
  for (const path of stagePaths) {
    try { exec(`git restore --staged --worktree -- ${shellQuote(path)}`) } catch {}
    try { exec(`git clean -fd -- ${shellQuote(path)}`) } catch {}
  }
  for (const path of forceAddPaths) {
    try { exec(`git clean -fdx -- ${shellQuote(path)}`) } catch {}
  }
}

function ensureLabels(labels: string[]): void {
  for (const label of labels) {
    try { exec(`gh label create "${label}" --force 2>/dev/null || true`) } catch {}
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

function listOpenPrHeads(): string[] {
  const heads = exec(`gh pr list --state open --base main --limit 1000 --json headRefName --jq '.[].headRefName'`)
  return heads ? heads.split("\n") : []
}

function deleteLocalBranch(branch: string): void {
  try { exec(`git branch -D ${shellQuote(branch)}`) } catch {}
}

function stageSyncChanges(stagePaths: string[], forceAddPaths: string[]): void {
  for (const path of stagePaths) exec(`git add -A -- ${shellQuote(path)}`)
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
  pluginName: string,
  repo: string,
  branch: string,
  isDraft: boolean,
  body: string,
  stagePaths: string[],
  forceAddPaths: string[],
  branchSyncState: SyncState,
): PrResult {
  const title = isDraft
    ? `同步：更新 ${skillName}（来自 ${repo}）[补丁失败]`
    : `同步：更新 ${skillName}（来自 ${repo}）`
  const labelList = isDraft ? ["自动同步", "补丁失败"] : ["自动同步"]

  if (findOpenSyncBranch(listOpenPrHeads(), skillName)) return "branch-exists"

  if (remoteBranchExists(branch)) {
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

  const versionBump = bumpPluginVersion(readFileSync(MARKETPLACE_CONFIG_PATH, "utf-8"), pluginName)
  writeFileSync(MARKETPLACE_CONFIG_PATH, versionBump.content)
  exec("npx tsx scripts/build-marketplace.ts")
  writeSyncState(branchSyncState)
  stageSyncChanges([MARKETPLACE_CONFIG_PATH, SYNC_STATE_PATH, ...GENERATED_MANIFEST_PATHS], [])

  exec(`git -c user.name="github-actions" -c user.email="actions@github.com" commit -m "同步：更新 ${skillName}"`)
  exec(`git push -u origin ${shellQuote(branch)}`)

  const bodyFile = join(ROOT, ".tmp-pr-body.md")
  writeFileSync(
    bodyFile,
    `${body}\n## Plugin 版本\n\n- \`${pluginName}\`: \`${versionBump.previousVersion}\` → \`${versionBump.nextVersion}\`\n`,
  )
  ensureLabels(labelList)

  const draftFlag = isDraft ? "--draft" : ""
  const labelFlag = labelList.map((l) => `--label "${l}"`).join(" ")
  exec(`gh pr create --title "${title}" --body-file "${bodyFile}" ${labelFlag} ${draftFlag}`)

  rmSync(bodyFile, { force: true })
  exec("git checkout main")
  deleteLocalBranch(branch)
  return "created"
}

function main(): void {
  const overrides = readOverrides()
  const syncState = readSyncState()
  let updated = false

  const plan = planSync(overrides.skills)

  for (const skillName of findOrphanedStateKeys(Object.keys(syncState), plan.sync.map(([name]) => name))) {
    console.log(`🧹 ${skillName}: 从同步状态中移除已删除的配置`)
    delete syncState[skillName]
    updated = true
  }

  for (const skillName of plan.skipped) {
    console.log(`🔒 ${skillName}: 本地自有 Skill，跳过上游同步`)
  }

  for (const [skillName, rawConfig] of plan.sync) {
    const config = rawConfig as UpstreamSkillConfig
    const { source, plugin, patches, target_patches, exclude_files } = config
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
    const upstreamFiles = fetchUpstreamFiles(source.repo, source.ref, source.path, destDir, exclude_files)

    if (upstreamFiles.length === 0) {
      console.log(`⚠️  ${skillName}: 上游路径为空，跳过`)
      continue
    }

    const removedFiles = removeDeletedUpstreamFiles(destDir, previousState?.files, upstreamFiles)
    const conflicts = findNewFileConflicts(existingLocalFiles, previousState?.files, upstreamFiles)

    let patchFailed = false
    const reports: string[] = []
    const patchSets: TargetPatchSet[] = [
      ...(patches.length > 0 ? [{ target: "SKILL.md", patches }] : []),
      ...(target_patches ?? []),
    ]

    for (const patchSet of patchSets) {
      const patchPath = join(destDir, patchSet.target)
      if (!existsSync(patchPath)) {
        patchFailed = true
        reports.push(`- ❌ [${patchSet.target}] 补丁目标不存在`)
        continue
      }

      const content = readFileSync(patchPath, "utf-8")
      const { final, results } = applyPatches(content, patchSet.patches)
      writeFileSync(patchPath, final)

      for (const result of results) {
        if (!result.ok) patchFailed = true
        reports.push(`- ${result.ok ? "✅" : "❌"} [${patchSet.target} / ${result.patch.type}] ${result.msg}`)
      }
    }

    let body = `## 上游变更\n\n`
    body += `- 来源: \`${source.repo}\` / \`${source.path}\`\n`
    body += `- 分支: \`${source.ref}\`\n`
    body += `- SHA: \`${latestSha.slice(0, 12)}\`\n`
    body += `- 文件: ${upstreamFiles.join(", ")}\n`
    if (removedFiles.length > 0) body += `- 上游已删除: ${removedFiles.join(", ")}\n`
    if (reports.length > 0) body += `\n## 补丁结果\n\n${reports.join("\n")}\n`
    if (conflicts.length > 0) {
      body += `\n## ⚠️ 文件名冲突\n\n以下上游新增文件与本地文件同名，需手动处理：\n`
      body += conflicts.map((f) => `- \`${f}\``).join("\n") + "\n"
      patchFailed = true
    }

    const candidateState: SyncStateEntry = { sha: latestSha, files: upstreamFiles }
    const branch = `sync/${skillName}-${latestSha.slice(0, 7)}`
    const stagePaths = [destDir, MARKETPLACE_CONFIG_PATH, ...GENERATED_MANIFEST_PATHS]
    const forceAddPaths = upstreamFiles.map((file) => join(destDir, file))

    try {
      const result = createPr(
        skillName,
        plugin,
        source.repo,
        branch,
        patchFailed,
        body,
        stagePaths,
        forceAddPaths,
        syncStateForPrBranch(readSyncState(), skillName, candidateState),
      )
      if (result === "created") {
        console.log(`  📬 PR 已创建${patchFailed ? " (Draft)" : ""}，同步状态随 PR 合入`)
      } else if (result === "no-changes") {
        console.log(`  ⏭️  ${skillName}: 文件内容无变化，记录最新状态`)
      } else {
        console.log(`  ⏭️  ${skillName}: 已有 Open PR，保持已接受的同步状态`)
        cleanPaths(stagePaths, forceAddPaths)
      }

      const nextState = syncStateAfterPr(syncState, skillName, candidateState, result)
      if (nextState !== syncState) {
        syncState[skillName] = candidateState
        updated = true
      }
    } catch (e) {
      try { exec("git checkout main") } catch {}
      cleanPaths([...stagePaths, SYNC_STATE_PATH], forceAddPaths)
      console.log(`  ❌ PR 创建失败: ${e}`)
    }
  }

  if (updated) writeSyncState(syncState)
  exec("npx tsx scripts/build-marketplace.ts")
  console.log("\n✅ 同步完成")
}

try {
  main()
} catch (e) {
  console.error("同步失败:", e)
  process.exit(1)
}
