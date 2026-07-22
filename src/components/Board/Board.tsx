import { memo, useMemo, useState } from 'react'
import { Background, ReactFlow, type Viewport } from '@xyflow/react'
import { BusEdge } from '../BusEdge'
import { ChipFileNode } from '../ChipFileNode'
import { ClassicEdge } from '../ClassicEdge'
import { FolderBlockNode } from '../FolderBlockNode'
import type { BoardProps } from './types'

function BoardImpl({
  graphMode,
  routingStyle,
  folderPacking,
  selectedNodeId,
  setSelectedNodeId,
  directionFilter,
  setDirectionFilter,
  edgeKindFilter,
  edgeColorPriority,
  flowGraph,
  displayEdges,
  renderedNodes,
  matchingFileNodeIds,
  isLayouting,
  isCanvasLocked,
  onNodeClick,
}: BoardProps) {
  const nodeTypes = useMemo(() => ({ chipFile: ChipFileNode, folderBlock: FolderBlockNode }), [])
  const edgeTypes = useMemo(() => ({ bus: BusEdge, classicLine: ClassicEdge }), [])
  const [savedViewport, setSavedViewport] = useState<Viewport | null>(null)

  if (!flowGraph) {
    return <div className="board-canvas-shell board-canvas-empty">Loading...</div>
  }

  return (
    <div className="board-canvas-shell">
      <p className="canvas-meta canvas-meta-overlay">
        Blocks: {flowGraph.blockCount}, Nodes: {flowGraph.nodes.length}, Visible edges: {displayEdges.length}
        {' | '}Cycles: {flowGraph.cycleEdgeCount}
        {' | '}Matches: {matchingFileNodeIds.size}
        {isLayouting ? ' | Layout: running...' : ' | Layout: ELK ready'}
      </p>
      <ReactFlow
        key={`rf-${graphMode}-${routingStyle}-${folderPacking}-${
          routingStyle === 'classic'
            ? `${selectedNodeId ?? 'none'}-${directionFilter}-${edgeKindFilter}-${edgeColorPriority}`
            : `stable-${edgeKindFilter}-${edgeColorPriority}`
        }`}
        nodes={renderedNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={() => {
          setSelectedNodeId(null)
          setDirectionFilter('all')
        }}
        defaultViewport={savedViewport ?? { x: 0, y: 0, zoom: 1 }}
        fitView={!savedViewport}
        minZoom={0.1}
        maxZoom={1.5}
        panOnDrag={!isCanvasLocked}
        panOnScroll={!isCanvasLocked}
        zoomOnScroll={!isCanvasLocked}
        zoomOnPinch={!isCanvasLocked}
        zoomOnDoubleClick={!isCanvasLocked}
        nodesDraggable={!isCanvasLocked}
        elementsSelectable={!isCanvasLocked}
        onInit={(instance) => {
          setSavedViewport(instance.getViewport())
        }}
        onMoveEnd={(_event, viewport) => {
          setSavedViewport(viewport)
        }}
      >
        <Background gap={24} size={1} color="#3a6689" />
      </ReactFlow>
    </div>
  )
}

export const Board = memo(BoardImpl)
