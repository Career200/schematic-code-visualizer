import type { DependencyEdge } from './lib/models'

export type FolderDepthMode = 'auto' | 'preset' | 'manual'
export type ManualFolderDepth = 'any' | number
export type EdgeKindFilter = 'all' | DependencyEdge['kind']
export type EdgeColorPriority = 'direction' | 'kind'

export type CycleGroup = {
  id: number
  size: number
  filePaths: string[]
}
