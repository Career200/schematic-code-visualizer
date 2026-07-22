import type { Edge, Node, NodeMouseHandler } from '@xyflow/react'
import type { BuiltGraph, FolderPackingMode, GraphBuildMode, RoutingStyle } from '../../lib/graph-builder'
import type { EdgeColorPriority, EdgeKindFilter } from '../../types'

export type BoardProps = {
  graphMode: GraphBuildMode
  routingStyle: RoutingStyle
  folderPacking: FolderPackingMode

  selectedNodeId: string | null
  setSelectedNodeId: (value: string | null) => void
  directionFilter: 'all' | 'incoming' | 'outgoing'
  setDirectionFilter: (value: 'all' | 'incoming' | 'outgoing') => void
  edgeKindFilter: EdgeKindFilter
  edgeColorPriority: EdgeColorPriority

  flowGraph: BuiltGraph | null
  displayEdges: Edge[]
  renderedNodes: Node[]
  matchingFileNodeIds: Set<string>
  isLayouting: boolean
  isCanvasLocked: boolean

  onNodeClick: NodeMouseHandler
}
