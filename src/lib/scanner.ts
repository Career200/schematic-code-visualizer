import type { ScannedProject, SourceFileRecord, TreeNode } from './models'
import { joinPath } from './path-utils'

const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'build'])
const TARGET_EXTENSIONS = ['.ts', '.tsx']

function isTargetFile(name: string) {
  return TARGET_EXTENSIONS.some((extension) => name.endsWith(extension)) && !name.endsWith('.d.ts')
}

type ScanTreeResult = {
  node: TreeNode
  files: SourceFileRecord[]
  tsFileCount: number
  directoryCount: number
}

async function scanTree(directoryHandle: FileSystemDirectoryHandle, parentPath: string): Promise<ScanTreeResult> {
  const currentPath = parentPath ? joinPath(parentPath, directoryHandle.name) : directoryHandle.name
  const files: TreeNode[] = []
  const directories: TreeNode[] = []
  const sourceFiles: SourceFileRecord[] = []
  let tsFileCount = 0
  let directoryCount = 1

  for await (const entry of directoryHandle.values()) {
    if (entry.kind === 'directory') {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue
      }
      const nested = await scanTree(entry, currentPath)
      if (nested.node.children && nested.node.children.length > 0) {
        directories.push(nested.node)
      }
      sourceFiles.push(...nested.files)
      tsFileCount += nested.tsFileCount
      directoryCount += nested.directoryCount
      continue
    }

    if (entry.kind === 'file' && isTargetFile(entry.name)) {
      const file = await entry.getFile()
      const filePath = joinPath(currentPath, entry.name)
      files.push({ name: entry.name, path: filePath, type: 'file' })
      sourceFiles.push({
        name: entry.name,
        path: filePath,
        content: await file.text(),
      })
      tsFileCount += 1
    }
  }

  directories.sort((left, right) => left.name.localeCompare(right.name))
  files.sort((left, right) => left.name.localeCompare(right.name))

  return {
    node: {
      name: directoryHandle.name,
      path: currentPath,
      type: 'directory',
      children: [...directories, ...files],
    },
    files: sourceFiles,
    tsFileCount,
    directoryCount,
  }
}

export async function scanProjectFolder(directoryHandle: FileSystemDirectoryHandle): Promise<ScannedProject> {
  const result = await scanTree(directoryHandle, '')
  return {
    rootName: directoryHandle.name,
    tree: result.node,
    files: result.files,
    tsFileCount: result.tsFileCount,
    directoryCount: result.directoryCount,
  }
}
