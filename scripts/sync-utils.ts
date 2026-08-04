import { chmodSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

export function copyFilePreservingMode(srcPath: string, destPath: string): void {
  mkdirSync(join(destPath, ".."), { recursive: true })
  writeFileSync(destPath, readFileSync(srcPath))
  chmodSync(destPath, statSync(srcPath).mode & 0o777)
}

/**
 * `ownership: local` marks a Skill the repository maintains itself. Everything
 * else is upstream-owned and therefore fetched, patched and state-tracked.
 */
export function isUpstreamOwned<T extends { readonly ownership?: string }>(
  entry: T,
): entry is Exclude<T, { readonly ownership: "local" }> {
  return entry.ownership !== "local"
}

export function upstreamOwnedNames(
  skills: Readonly<Record<string, { readonly ownership?: string }>>,
): string[] {
  return Object.entries(skills)
    .filter(([, entry]) => isUpstreamOwned(entry))
    .map(([name]) => name)
}

export interface SyncPlan<T> {
  /** Skills the sync job fetches, patches and records in `.sync-state.json`. */
  readonly sync: ReadonlyArray<readonly [string, Exclude<T, { readonly ownership: "local" }>]>
  /** Locally owned Skills the sync job leaves untouched. */
  readonly skipped: readonly string[]
}

export function planSync<T extends { readonly ownership?: string }>(
  skills: Readonly<Record<string, T>>,
): SyncPlan<T> {
  const sync: Array<readonly [string, Exclude<T, { readonly ownership: "local" }>]> = []
  const skipped: string[] = []

  for (const [name, entry] of Object.entries(skills)) {
    if (isUpstreamOwned(entry)) sync.push([name, entry])
    else skipped.push(name)
  }

  return { sync, skipped }
}

export function findOrphanedStateKeys(
  stateKeys: readonly string[],
  configuredKeys: readonly string[],
): string[] {
  const configured = new Set(configuredKeys)
  return stateKeys.filter((key) => !configured.has(key))
}

export interface SparseCheckoutPlan {
  readonly checkoutWholeRepo: boolean
  readonly directories: readonly string[]
}

export function toSparseDir(path: string): string {
  if (path === "." || path === "") return "."
  const normalized = path.replace(/\/+$/, "")
  const lastSegment = normalized.split("/").pop() ?? ""
  return lastSegment.includes(".") ? dirname(normalized) : normalized
}

export function planSparseCheckout(paths: readonly string[]): SparseCheckoutPlan {
  const directories = [...new Set(paths.map(toSparseDir))]
  if (directories.includes(".")) {
    return { checkoutWholeRepo: true, directories: [] }
  }
  return { checkoutWholeRepo: false, directories }
}

export function isExcludedFile(file: string, excludeRules: readonly string[]): boolean {
  return excludeRules.some((rule) => (rule.endsWith("/") ? file.startsWith(rule) : file === rule))
}

export function findRemovedFiles(
  previousUpstreamFiles: readonly string[],
  currentUpstreamFiles: readonly string[],
): string[] {
  const current = new Set(currentUpstreamFiles)
  return previousUpstreamFiles.filter((file) => !current.has(file))
}

export function findNewFileConflicts(
  existingFiles: readonly string[],
  previousUpstreamFiles: readonly string[] | undefined,
  currentUpstreamFiles: readonly string[],
): string[] {
  if (!previousUpstreamFiles) return []

  const existing = new Set(existingFiles)
  const previous = new Set(previousUpstreamFiles)
  return currentUpstreamFiles.filter(
    (file) => !previous.has(file) && existing.has(file),
  )
}
