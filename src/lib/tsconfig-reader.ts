import type { TsConfigAliasConfig } from './models'
import { dirname, joinPath, normalizePath } from './path-utils'

type TsConfigRoot = {
  extends?: string
  compilerOptions?: {
    baseUrl?: string
    paths?: Record<string, string[]>
  }
}

const MAX_EXTENDS_DEPTH = 8

async function readFileTextByRelativePath(
  rootHandle: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<string | null> {
  try {
    const normalizedPath = normalizePath(relativePath)
    const segments = normalizedPath.split('/').filter(Boolean)
    if (segments.length === 0) {
      return null
    }

    let directory = rootHandle
    for (let index = 0; index < segments.length - 1; index += 1) {
      directory = await directory.getDirectoryHandle(segments[index])
    }

    const fileHandle = await directory.getFileHandle(segments[segments.length - 1])
    const file = await fileHandle.getFile()
    return await file.text()
  } catch {
    return null
  }
}

function mergePathMappings(
  parentPaths: Record<string, string[]> | undefined,
  localPaths: Record<string, string[]> | undefined,
) {
  const merged: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(parentPaths ?? {})) {
    merged[key] = [...value]
  }
  for (const [key, value] of Object.entries(localPaths ?? {})) {
    merged[key] = [...value]
  }
  return Object.keys(merged).length > 0 ? merged : undefined
}

function resolveExtendsPath(currentConfigPath: string, extendsValue: string) {
  if (!extendsValue.startsWith('.') && !extendsValue.startsWith('/')) {
    return null
  }

  let resolved = extendsValue.startsWith('/')
    ? normalizePath(extendsValue.slice(1))
    : joinPath(dirname(currentConfigPath), extendsValue)

  if (!resolved.endsWith('.json')) {
    resolved = `${resolved}.json`
  }
  return resolved
}

async function readAliasConfigRecursive(
  rootHandle: FileSystemDirectoryHandle,
  configPath: string,
  depth: number,
  visited: Set<string>,
): Promise<TsConfigAliasConfig | null> {
  if (depth > MAX_EXTENDS_DEPTH) {
    return null
  }

  const normalizedConfigPath = normalizePath(configPath)
  if (visited.has(normalizedConfigPath)) {
    return null
  }
  visited.add(normalizedConfigPath)

  const configText = await readFileTextByRelativePath(rootHandle, normalizedConfigPath)
  if (!configText) {
    return null
  }

  let rawConfig: TsConfigRoot
  try {
    rawConfig = JSON.parse(configText) as TsConfigRoot
  } catch {
    return null
  }

  let inherited: TsConfigAliasConfig | null = null
  if (typeof rawConfig.extends === 'string') {
    const resolvedExtendsPath = resolveExtendsPath(normalizedConfigPath, rawConfig.extends)
    if (resolvedExtendsPath) {
      inherited = await readAliasConfigRecursive(rootHandle, resolvedExtendsPath, depth + 1, visited)
    }
  }

  const compilerOptions = rawConfig.compilerOptions ?? {}
  const localBaseUrl = typeof compilerOptions.baseUrl === 'string' && compilerOptions.baseUrl.length > 0
    ? joinPath(dirname(normalizedConfigPath), compilerOptions.baseUrl)
    : undefined
  const localPaths = compilerOptions.paths

  const mergedBaseUrl = localBaseUrl ?? inherited?.baseUrl
  const mergedPaths = mergePathMappings(inherited?.paths, localPaths)

  if (!mergedBaseUrl && !mergedPaths) {
    return null
  }

  return {
    baseUrl: mergedBaseUrl,
    paths: mergedPaths,
  }
}

export async function readTsConfigAliasConfig(
  directoryHandle: FileSystemDirectoryHandle,
): Promise<TsConfigAliasConfig | null> {
  try {
    return await readAliasConfigRecursive(directoryHandle, 'tsconfig.json', 0, new Set())
  } catch {
    return null
  }
}
