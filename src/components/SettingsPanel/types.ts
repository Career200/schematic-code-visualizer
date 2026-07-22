import type { Dispatch, SetStateAction } from 'react'
import type { BuiltGraph, FolderPackingMode, GraphBuildMode, RoutingStyle } from '../../lib/graph-builder'
import type { EdgeColorPriority, EdgeKindFilter, FolderDepthMode, ManualFolderDepth } from '../../types'

export type SettingsPanelProps = {
  graphMode: GraphBuildMode
  setGraphMode: (mode: GraphBuildMode) => void

  showExternalImports: boolean
  setShowExternalImports: (value: boolean) => void
  simplifyHighlightedRoutes: boolean
  setSimplifyHighlightedRoutes: (value: boolean) => void
  traceIntoCollapsedFolders: boolean
  setTraceIntoCollapsedFolders: (value: boolean) => void
  highlightCycles: boolean
  setHighlightCycles: (value: boolean) => void

  selectedNodeId: string | null
  setSelectedNodeId: (value: string | null) => void
  directionFilter: 'all' | 'incoming' | 'outgoing'
  setDirectionFilter: (value: 'all' | 'incoming' | 'outgoing') => void

  edgeKindFilter: EdgeKindFilter
  setEdgeKindFilter: (value: EdgeKindFilter) => void
  edgeColorPriority: EdgeColorPriority
  setEdgeColorPriority: (value: EdgeColorPriority) => void
  routingStyle: RoutingStyle
  setRoutingStyle: (value: RoutingStyle) => void
  folderPacking: FolderPackingMode
  setFolderPacking: (value: FolderPackingMode) => void

  folderDepthMode: FolderDepthMode
  setFolderDepthMode: (value: FolderDepthMode) => void
  manualFolderDepth: ManualFolderDepth
  setManualFolderDepth: (value: ManualFolderDepth) => void

  searchQuery: string
  setSearchQuery: (value: string) => void
  collapsedBlockIds: Set<string>
  setCollapsedBlockIds: Dispatch<SetStateAction<Set<string>>>
  fileNodeToBlockId: Map<string, string>

  flowGraph: BuiltGraph | null

  isCanvasLocked: boolean
  setIsCanvasLocked: Dispatch<SetStateAction<boolean>>
}
