import { chmodSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

export function copyFilePreservingMode(srcPath: string, destPath: string): void {
  mkdirSync(join(destPath, ".."), { recursive: true })
  writeFileSync(destPath, readFileSync(srcPath))
  chmodSync(destPath, statSync(srcPath).mode & 0o777)
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
