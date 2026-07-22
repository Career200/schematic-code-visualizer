import type { DependencyEdge, DependencyGraph, FileAnalysis, ScannedProject, SourceFileRecord, TreeNode } from './models'

const DEMO_ROOT = 'demo-app'

type DemoFile = {
  path: string
  imports: Array<{ to: string; kind: DependencyEdge['kind'] }>
  exportCount: number
  loc: number
}

// Handcrafted, not scanned: small enough to read at a glance, shaped to demonstrate
// every insight the app surfaces — a hotspot (shared/format.ts), a two-file cycle
// (domain/order.ts <-> domain/pricing.ts), and an unused export (domain/legacy.ts).
const DEMO_FILES: DemoFile[] = [
  { path: 'src/main.tsx', imports: [{ to: 'src/app/App.tsx', kind: 'runtime' }], exportCount: 0, loc: 12 },
  {
    path: 'src/app/App.tsx',
    imports: [
      { to: 'src/components/Header.tsx', kind: 'runtime' },
      { to: 'src/components/OrderList.tsx', kind: 'runtime' },
      { to: 'src/domain/order.ts', kind: 'runtime' },
    ],
    exportCount: 1,
    loc: 64,
  },
  {
    path: 'src/components/Header.tsx',
    imports: [{ to: 'src/shared/format.ts', kind: 'runtime' }],
    exportCount: 1,
    loc: 28,
  },
  {
    path: 'src/components/OrderList.tsx',
    imports: [
      { to: 'src/domain/order.ts', kind: 'runtime' },
      { to: 'src/shared/format.ts', kind: 'runtime' },
      { to: 'src/shared/types.ts', kind: 'type' },
    ],
    exportCount: 1,
    loc: 54,
  },
  {
    path: 'src/components/PriceTag.tsx',
    imports: [
      { to: 'src/domain/pricing.ts', kind: 'runtime' },
      { to: 'src/shared/format.ts', kind: 'runtime' },
    ],
    exportCount: 1,
    loc: 22,
  },
  {
    path: 'src/domain/order.ts',
    imports: [
      { to: 'src/domain/pricing.ts', kind: 'runtime' },
      { to: 'src/shared/format.ts', kind: 'runtime' },
      { to: 'src/shared/types.ts', kind: 'type' },
    ],
    exportCount: 3,
    loc: 88,
  },
  {
    path: 'src/domain/pricing.ts',
    imports: [
      { to: 'src/domain/order.ts', kind: 'runtime' },
      { to: 'src/shared/format.ts', kind: 'runtime' },
    ],
    exportCount: 2,
    loc: 70,
  },
  {
    path: 'src/domain/legacy.ts',
    imports: [{ to: 'src/shared/types.ts', kind: 'type' }],
    exportCount: 2,
    loc: 40,
  },
  { path: 'src/shared/format.ts', imports: [], exportCount: 4, loc: 36 },
  { path: 'src/shared/types.ts', imports: [], exportCount: 5, loc: 30 },
  {
    path: 'src/shared/index.ts',
    imports: [
      { to: 'src/shared/format.ts', kind: 're-export' },
      { to: 'src/shared/types.ts', kind: 're-export' },
    ],
    exportCount: 9,
    loc: 4,
  },
]

function toTreeNode(files: SourceFileRecord[], rootName: string): TreeNode {
  const root: TreeNode = { name: rootName, path: rootName, type: 'directory', children: [] }
  const dirsByPath = new Map<string, TreeNode>([[rootName, root]])

  const ensureDir = (path: string, name: string, parentPath: string): TreeNode => {
    const existing = dirsByPath.get(path)
    if (existing) return existing
    const parent = dirsByPath.get(parentPath)!
    const created: TreeNode = { name, path, type: 'directory', children: [] }
    parent.children!.push(created)
    dirsByPath.set(path, created)
    return created
  }

  for (const file of files) {
    const segments = file.path.split('/')
    let parentPath = rootName
    for (let index = 0; index < segments.length - 1; index += 1) {
      const dirPath = `${rootName}/${segments.slice(0, index + 1).join('/')}`
      ensureDir(dirPath, segments[index], parentPath)
      parentPath = dirPath
    }
    const parent = dirsByPath.get(parentPath)!
    parent.children!.push({
      name: segments[segments.length - 1],
      path: `${rootName}/${file.path}`,
      type: 'file',
    })
  }

  return root
}

function buildDemoScannedProject(): ScannedProject {
  const files: SourceFileRecord[] = DEMO_FILES.map((file) => ({
    name: file.path.split('/').pop() ?? file.path,
    path: file.path,
    content: '// demo file\n'.repeat(Math.max(1, Math.round(file.loc / 12))),
  }))
  const directoryPaths = new Set<string>()
  for (const file of DEMO_FILES) {
    const segments = file.path.split('/')
    for (let index = 1; index < segments.length; index += 1) {
      directoryPaths.add(segments.slice(0, index).join('/'))
    }
  }
  return {
    rootName: DEMO_ROOT,
    tree: toTreeNode(files, DEMO_ROOT),
    files,
    tsFileCount: files.length,
    directoryCount: directoryPaths.size,
  }
}

function buildDemoDependencyGraph(): DependencyGraph {
  const fileAnalysisByPath = new Map<string, FileAnalysis>()
  for (const file of DEMO_FILES) {
    fileAnalysisByPath.set(file.path, {
      path: file.path,
      exports: Array.from({ length: file.exportCount }, (_unused, index) => `export${index + 1}`),
      imports: file.imports.map((edge) => edge.to),
      resolvedImports: file.imports.map((edge) => edge.to),
      unresolvedImports: [],
    })
  }

  const edges: DependencyEdge[] = []
  for (const file of DEMO_FILES) {
    for (const target of file.imports) {
      edges.push({
        fromPath: file.path,
        toPath: target.to,
        specifier: `./${target.to.split('/').pop()}`,
        kind: target.kind,
      })
    }
  }

  return {
    files: Array.from(fileAnalysisByPath.values()),
    edges,
    externalEdges: [],
    externalPackages: [],
    unresolvedImportCount: 0,
    unresolvedExternalCount: 0,
    unresolvedInternalCount: 0,
    aliasResolvedCount: 0,
  }
}

export function buildDemoProject() {
  return {
    scanResult: buildDemoScannedProject(),
    dependencyGraph: buildDemoDependencyGraph(),
  }
}

export const IS_DEMO_ROOT_NAME = DEMO_ROOT
