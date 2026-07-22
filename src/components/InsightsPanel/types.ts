export type HotspotFile = {
  path: string
  incoming: number
  outgoing: number
  exports: number
  loc: number
  score: number
}

export type CycleGroupSummary = {
  id: number
  size: number
  filePaths: string[]
}

export type DeadExportFile = {
  path: string
  exports: string[]
}

export type InsightsPanelProps = {
  hotspotFiles: HotspotFile[]
  topCycleGroups: CycleGroupSummary[]
  potentiallyDeadExportFiles: DeadExportFile[]

  selectedNodeId: string | null
  selectedFilePath: string | null
  selectedImportedFiles: string[]
  selectedImportedByFiles: string[]
  setSelectedNodeId: (value: string | null) => void
}

