import { useCallback, useEffect, useMemo, useState } from 'react'
import { ReactFlowProvider, type Edge, type NodeMouseHandler } from '@xyflow/react'
import { Board } from './components/Board'
import { InsightsPanel } from './components/InsightsPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { StructureModal } from './components/StructureModal'
import { TopBar } from './components/TopBar'
import { computeBusRoutes } from './lib/bus-router'
import { buildDemoProject, IS_DEMO_ROOT_NAME } from './lib/demo-graph'
import { routeDirectOrthogonal } from './lib/direct-router'
import { applyElkToBlockNodes } from './lib/elk-layout'
import {
  buildDependencyFlowGraph,
  type FolderPackingMode,
  type GraphBuildMode,
  type RoutingStyle,
} from './lib/graph-builder'
import { buildTreeLines } from './lib/tree-view'
import type { DependencyEdge, DependencyGraph, ScannedProject } from './lib/models'
import './App.css'
import '@xyflow/react/dist/style.css'

import type { EdgeColorPriority, EdgeKindFilter, FolderDepthMode, ManualFolderDepth } from './types'

import { findTopCycleGroups } from './utils/find-top-cycle-groups'
import { getFolderDepth } from './utils/get-folder-depth'
import { hashText } from './utils/hash-text'

const initialDemoProject = buildDemoProject()

function App() {
  const [scanResult, setScanResult] = useState<ScannedProject | null>(initialDemoProject.scanResult)
  const [dependencyGraph, setDependencyGraph] = useState<DependencyGraph | null>(initialDemoProject.dependencyGraph)
  const [graphMode, setGraphMode] = useState<GraphBuildMode>('file-level')
  const [routingStyle, setRoutingStyle] = useState<RoutingStyle>('classic')
  const [folderPacking, setFolderPacking] = useState<FolderPackingMode>('balanced')
  const [highlightCycles, setHighlightCycles] = useState(false)
  const [showExternalImports, setShowExternalImports] = useState(true)
  const [simplifyHighlightedRoutes, setSimplifyHighlightedRoutes] = useState(true)
  const [traceIntoCollapsedFolders, setTraceIntoCollapsedFolders] = useState(true)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [directionFilter, setDirectionFilter] = useState<'all' | 'incoming' | 'outgoing'>('all')
  const [edgeKindFilter, setEdgeKindFilter] = useState<EdgeKindFilter>('all')
  const [edgeColorPriority, setEdgeColorPriority] = useState<EdgeColorPriority>('direction')
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedBlockIds, setCollapsedBlockIds] = useState<Set<string>>(new Set())
  const [manualFolderDepth, setManualFolderDepth] = useState<ManualFolderDepth>(2)
  const [folderDepthMode, setFolderDepthMode] = useState<FolderDepthMode>('auto')
  const [layoutedNodes, setLayoutedNodes] = useState<ReturnType<typeof buildDependencyFlowGraph>['nodes']>([])
  const [isLayouting, setIsLayouting] = useState(false)
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false)
  const [isCanvasLocked, setIsCanvasLocked] = useState(false)
  const [depthSyncSnapshot, setDepthSyncSnapshot] = useState<{
    flowGraph: ReturnType<typeof buildDependencyFlowGraph> | null
    graphMode: GraphBuildMode
    folderDepthMode: FolderDepthMode
    manualFolderDepth: ManualFolderDepth
  } | null>(null)

  const isDemo = scanResult?.rootName === IS_DEMO_ROOT_NAME

  const fileLocByPath = useMemo(() => {
    const map = new Map<string, number>()
    for (const file of scanResult?.files ?? []) {
      const loc = file.content.split(/\r?\n/).length
      map.set(file.path, Math.max(1, loc))
    }
    return map
  }, [scanResult])

  const incomingEdgeCountByPath = useMemo(() => {
    const map = new Map<string, number>()
    for (const edge of dependencyGraph?.edges ?? []) {
      map.set(edge.toPath, (map.get(edge.toPath) ?? 0) + 1)
    }
    return map
  }, [dependencyGraph])
  const outgoingEdgeCountByPath = useMemo(() => {
    const map = new Map<string, number>()
    for (const edge of dependencyGraph?.edges ?? []) {
      map.set(edge.fromPath, (map.get(edge.fromPath) ?? 0) + 1)
    }
    return map
  }, [dependencyGraph])
  const hotspotFiles = useMemo(() => {
    if (!dependencyGraph) {
      return []
    }
    return dependencyGraph.files
      .map((file) => {
        const incoming = incomingEdgeCountByPath.get(file.path) ?? 0
        const outgoing = outgoingEdgeCountByPath.get(file.path) ?? 0
        const loc = fileLocByPath.get(file.path) ?? 0
        const score = incoming * 2 + outgoing + Math.round(loc / 180)
        return {
          path: file.path,
          incoming,
          outgoing,
          exports: file.exports.length,
          loc,
          score,
        }
      })
      .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
      .slice(0, 10)
  }, [dependencyGraph, fileLocByPath, incomingEdgeCountByPath, outgoingEdgeCountByPath])
  const potentiallyDeadExportFiles = useMemo(() => {
    if (!dependencyGraph) {
      return []
    }
    return dependencyGraph.files
      .filter((file) => file.exports.length > 0 && (incomingEdgeCountByPath.get(file.path) ?? 0) === 0)
      .sort((left, right) => right.exports.length - left.exports.length || left.path.localeCompare(right.path))
      .slice(0, 12)
  }, [dependencyGraph, incomingEdgeCountByPath])
  const topCycleGroups = useMemo(() => {
    if (!dependencyGraph) {
      return []
    }
    return findTopCycleGroups(
      dependencyGraph.files.map((file) => file.path),
      dependencyGraph.edges.map((edge) => ({ fromPath: edge.fromPath, toPath: edge.toPath })),
      5,
    )
  }, [dependencyGraph])
  // Runtime in/out edge counts per file, separate from `incoming/outgoingEdgeCountByPath` above
  // (those count all edge kinds; orphan detection specifically cares about runtime-only isolation).
  const runtimeEdgeCountByPath = useMemo(() => {
    const map = new Map<string, { incoming: number; outgoing: number }>()
    const ensure = (path: string) => {
      const existing = map.get(path)
      if (existing) return existing
      const created = { incoming: 0, outgoing: 0 }
      map.set(path, created)
      return created
    }
    for (const edge of dependencyGraph?.edges ?? []) {
      if (edge.kind !== 'runtime') continue
      ensure(edge.fromPath).outgoing += 1
      ensure(edge.toPath).incoming += 1
    }
    return map
  }, [dependencyGraph])
  const orphanRuntimeModules = useMemo(() => {
    if (!dependencyGraph) {
      return []
    }
    return dependencyGraph.files
      .filter((file) => {
        const lower = file.path.toLowerCase()
        if (lower.includes('/__tests__/') || lower.includes('.test.') || lower.includes('.spec.')) {
          return false
        }
        const runtime = runtimeEdgeCountByPath.get(file.path)
        return (runtime?.incoming ?? 0) === 0 && (runtime?.outgoing ?? 0) === 0
      })
      .map((file) => ({ path: file.path, exports: file.exports.length }))
      .sort((left, right) => right.exports - left.exports || left.path.localeCompare(right.path))
      .slice(0, 12)
  }, [dependencyGraph, runtimeEdgeCountByPath])
  const duplicateUtilityGroups = useMemo(() => {
    if (!scanResult || scanResult.files.length === 0) {
      return []
    }
    const groups = new Map<string, { baseName: string; paths: string[] }>()
    for (const file of scanResult.files) {
      const normalizedPath = file.path.toLowerCase()
      const isUtilityPath =
        normalizedPath.includes('/utils/') ||
        normalizedPath.includes('/helpers/') ||
        normalizedPath.includes('/common/') ||
        normalizedPath.includes('/shared/') ||
        normalizedPath.includes('/lib/') ||
        normalizedPath.includes('/hooks/') ||
        normalizedPath.endsWith('.util.ts') ||
        normalizedPath.endsWith('.utils.ts')
      if (!isUtilityPath) {
        continue
      }
      const fileName = file.path.split('/').pop() ?? file.path
      const normalizedContent = file.content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (!normalizedContent) {
        continue
      }
      const key = `${fileName.toLowerCase()}::${hashText(normalizedContent)}`
      const existing = groups.get(key)
      if (existing) {
        existing.paths.push(file.path)
      } else {
        groups.set(key, { baseName: fileName, paths: [file.path] })
      }
    }
    return [...groups.values()]
      .filter((item) => item.paths.length > 1)
      .map((item) => ({ baseName: item.baseName, paths: [...item.paths].sort((left, right) => left.localeCompare(right)) }))
      .sort((left, right) => right.paths.length - left.paths.length || left.baseName.localeCompare(right.baseName))
      .slice(0, 12)
  }, [scanResult])
  const flowGraph = useMemo(() => {
    if (!scanResult || !dependencyGraph) {
      return null
    }
    return buildDependencyFlowGraph(scanResult, dependencyGraph, graphMode, {
      highlightCycles,
      routingStyle,
      folderPacking,
      edgeKindFilter,
      includeExternalImports: showExternalImports,
    })
  }, [scanResult, dependencyGraph, graphMode, highlightCycles, routingStyle, folderPacking, edgeKindFilter, showExternalImports])

  const fileNodeToBlockId = useMemo(() => {
    const map = new Map<string, string>()
    for (const node of flowGraph?.nodes ?? []) {
      if (node.parentId && node.id.startsWith('file:')) {
        map.set(node.id, node.parentId)
      }
    }
    return map
  }, [flowGraph])

  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const matchingFileNodeIds = useMemo(() => {
    if (!flowGraph || !normalizedSearchQuery) {
      return new Set<string>()
    }
    const ids = new Set<string>()
    for (const node of flowGraph.nodes) {
      if (!node.id.startsWith('file:')) {
        continue
      }
      const filePath = node.id.slice(5)
      const label = String(node.data?.label ?? '')
      if (label.toLowerCase().includes(normalizedSearchQuery) || filePath.toLowerCase().includes(normalizedSearchQuery)) {
        ids.add(node.id)
      }
    }
    return ids
  }, [flowGraph, normalizedSearchQuery])

  const blockIdsWithMatches = useMemo(() => {
    const ids = new Set<string>()
    for (const fileNodeId of matchingFileNodeIds) {
      const blockId = fileNodeToBlockId.get(fileNodeId)
      if (blockId) {
        ids.add(blockId)
      }
    }
    return ids
  }, [matchingFileNodeIds, fileNodeToBlockId])

  const hiddenNodeIds = useMemo(() => {
    const ids = new Set<string>()
    if (!flowGraph || graphMode !== 'file-level' || collapsedBlockIds.size === 0) {
      return ids
    }
    const parentById = new Map<string, string>()
    for (const node of flowGraph.nodes) {
      if (node.parentId) {
        parentById.set(node.id, node.parentId)
      }
    }
    for (const node of flowGraph.nodes) {
      let parentId = node.parentId
      let isHidden = false
      while (parentId) {
        if (collapsedBlockIds.has(parentId)) {
          isHidden = true
          break
        }
        parentId = parentById.get(parentId)
      }
      if (isHidden) {
        ids.add(node.id)
      }
    }
    return ids
  }, [flowGraph, graphMode, collapsedBlockIds])

  const visibleEdges = useMemo(() => {
    if (!flowGraph) {
      return []
    }
    const parentByNodeId = new Map<string, string>()
    for (const node of flowGraph.nodes) {
      if (node.parentId) parentByNodeId.set(node.id, node.parentId)
    }
    const findVisibleAncestor = (nodeId: string): string | null => {
      let cur: string | undefined = nodeId
      while (cur && hiddenNodeIds.has(cur)) {
        cur = parentByNodeId.get(cur)
      }
      return cur ?? null
    }
    let filteredByCollapse: Edge[]
    if (traceIntoCollapsedFolders && selectedNodeId) {
      filteredByCollapse = []
      for (const edge of flowGraph.edges) {
        const sourceHidden = hiddenNodeIds.has(edge.source)
        const targetHidden = hiddenNodeIds.has(edge.target)
        if (!sourceHidden && !targetHidden) {
          filteredByCollapse.push(edge)
          continue
        }
        // Only redirect when the visible endpoint is the selected node — otherwise drop.
        const visibleEnd = sourceHidden ? edge.target : edge.source
        if (visibleEnd !== selectedNodeId) continue
        const newSource = sourceHidden ? findVisibleAncestor(edge.source) : edge.source
        const newTarget = targetHidden ? findVisibleAncestor(edge.target) : edge.target
        if (!newSource || !newTarget || newSource === newTarget) continue
        filteredByCollapse.push({
          ...edge,
          id: `${edge.id}::traced`,
          source: newSource,
          target: newTarget,
          data: {
            ...(edge.data ?? {}),
            tracedToCollapsed: true,
            originalSource: edge.source,
            originalTarget: edge.target,
          },
        })
      }
    } else {
      filteredByCollapse = flowGraph.edges.filter(
        (edge) => !hiddenNodeIds.has(edge.source) && !hiddenNodeIds.has(edge.target),
      )
    }
    if (!selectedNodeId) {
      return filteredByCollapse
    }
    if (directionFilter === 'incoming') {
      return filteredByCollapse.filter((edge) => edge.target === selectedNodeId)
    }
    if (directionFilter === 'outgoing') {
      return filteredByCollapse.filter((edge) => edge.source === selectedNodeId)
    }
    return filteredByCollapse.filter((edge) => edge.source === selectedNodeId || edge.target === selectedNodeId)
  }, [flowGraph, hiddenNodeIds, selectedNodeId, directionFilter, traceIntoCollapsedFolders])

  const connectedNodeIds = useMemo(() => {
    const ids = new Set<string>()
    if (!selectedNodeId) {
      return ids
    }
    ids.add(selectedNodeId)
    for (const edge of visibleEdges) {
      ids.add(edge.source)
      ids.add(edge.target)
    }
    return ids
  }, [selectedNodeId, visibleEdges])

  const incomingRelatedNodeIds = useMemo(() => {
    const ids = new Set<string>()
    if (!selectedNodeId) {
      return ids
    }
    for (const edge of visibleEdges) {
      if (edge.target === selectedNodeId) {
        ids.add(edge.source)
      }
    }
    return ids
  }, [selectedNodeId, visibleEdges])

  const outgoingRelatedNodeIds = useMemo(() => {
    const ids = new Set<string>()
    if (!selectedNodeId) {
      return ids
    }
    for (const edge of visibleEdges) {
      if (edge.source === selectedNodeId) {
        ids.add(edge.target)
      }
    }
    return ids
  }, [selectedNodeId, visibleEdges])

  const visibleNodes = useMemo(() => {
    if (!flowGraph || layoutedNodes.length === 0) {
      return []
    }
    return layoutedNodes
      .filter((node) => !hiddenNodeIds.has(node.id))
      .map((node) => {
        const isSelected = node.id === selectedNodeId
        const isConnected = connectedNodeIds.has(node.id)
        const isFileNode = node.id.startsWith('file:')
        const isMatch = matchingFileNodeIds.has(node.id)
        const isBlockWithMatch = blockIdsWithMatches.has(node.id)
        const isIncomingRelated = incomingRelatedNodeIds.has(node.id)
        const isOutgoingRelated = outgoingRelatedNodeIds.has(node.id)
        const nextStyle = {
          ...(node.style ?? {}),
          opacity: 1,
        }
        if (selectedNodeId) {
          nextStyle.opacity = isConnected ? 1 : 0.32
        }
        if (normalizedSearchQuery) {
          if (isFileNode && !isMatch) {
            nextStyle.opacity = Math.min(nextStyle.opacity, 0.2)
          }
          if (!isFileNode && !isBlockWithMatch) {
            nextStyle.opacity = Math.min(nextStyle.opacity, 0.3)
          }
        }
        if (selectedNodeId && isSelected) {
          nextStyle.border = '2px solid #ffe79f'
          nextStyle.boxShadow = '0 0 0 2px rgba(255, 231, 159, 0.5), 0 0 14px rgba(255, 231, 159, 0.35)'
        } else if (selectedNodeId && (isIncomingRelated || isOutgoingRelated)) {
          if (isIncomingRelated && !isOutgoingRelated) {
            nextStyle.border = '2px solid #6fdc9a'
          } else if (isOutgoingRelated && !isIncomingRelated) {
            nextStyle.border = '2px solid #f5b04d'
          } else {
            nextStyle.border = '2px solid #ffe79f'
          }
        }
        if (normalizedSearchQuery && isMatch && !isSelected) {
          nextStyle.boxShadow = '0 0 0 2px rgba(255, 231, 159, 0.55)'
        } else if (!isSelected) {
          nextStyle.boxShadow = 'none'
        }
        return {
          ...node,
          style: nextStyle,
        }
      })
  }, [
    flowGraph,
    layoutedNodes,
    hiddenNodeIds,
    selectedNodeId,
    connectedNodeIds,
    incomingRelatedNodeIds,
    outgoingRelatedNodeIds,
    normalizedSearchQuery,
    matchingFileNodeIds,
    blockIdsWithMatches,
  ])

  const busRouteIndex = useMemo(
    () =>
      computeBusRoutes({
        visibleNodes,
        visibleEdges,
        fileNodeToBlockId,
        routingStyle,
      }),
    [visibleNodes, visibleEdges, fileNodeToBlockId, routingStyle],
  )

  const directRouteContext = useMemo(() => {
    type Rect = { x: number; y: number; width: number; height: number }
    const nodeById = new Map(visibleNodes.map((node) => [node.id, node]))
    const parentByNodeId = new Map<string, string>()
    for (const node of visibleNodes) {
      if (node.parentId) parentByNodeId.set(node.id, node.parentId)
    }
    const rectById = new Map<string, Rect>()
    const computeRect = (nodeId: string): Rect | null => {
      const cached = rectById.get(nodeId)
      if (cached) return cached
      const node = nodeById.get(nodeId)
      if (!node) return null
      const width = Number(node.style?.width ?? 0)
      const height = Number(node.style?.height ?? 0)
      let rect: Rect
      if (!node.parentId) {
        rect = { x: node.position.x, y: node.position.y, width, height }
      } else {
        const parentRect = computeRect(node.parentId)
        if (!parentRect) return null
        rect = { x: parentRect.x + node.position.x, y: parentRect.y + node.position.y, width, height }
      }
      rectById.set(nodeId, rect)
      return rect
    }
    for (const node of visibleNodes) computeRect(node.id)
    // Obstacles: files + collapsed folders that are in the current highlight set
    // (i.e., the selected node and its visible neighbours). Unrelated/dimmed nodes
    // are transparent — wires pass through them freely. Expanded folders are also
    // transparent so the direct router can hop diagonal-ish through containers.
    const baseObstacles: Array<{ id: string; rect: Rect }> = []
    for (const node of visibleNodes) {
      if (!connectedNodeIds.has(node.id)) continue
      const rect = rectById.get(node.id)
      if (!rect) continue
      const isFile = node.id.startsWith('file:')
      const isCollapsedFolder = node.id.startsWith('block:') && collapsedBlockIds.has(node.id)
      if (isFile || isCollapsedFolder) {
        baseObstacles.push({ id: node.id, rect })
      }
    }
    const ancestorIds = (nodeId: string): Set<string> => {
      const set = new Set<string>([nodeId])
      let cur: string | undefined = parentByNodeId.get(nodeId)
      while (cur) {
        set.add(cur)
        cur = parentByNodeId.get(cur)
      }
      return set
    }
    return { rectById, parentByNodeId, baseObstacles, ancestorIds }
  }, [visibleNodes, collapsedBlockIds, connectedNodeIds])

  const renderedNodes = useMemo(() => {
    if (busRouteIndex.pinsByFolderId.size === 0) return visibleNodes
    return visibleNodes.map((node) => {
      if (!node.id.startsWith('block:')) return node
      const pins = busRouteIndex.pinsByFolderId.get(node.id)
      if (!pins) return node
      return {
        ...node,
        data: {
          ...(node.data ?? {}),
          exportPinYs: pins.exports,
          importPinYs: pins.imports,
        },
      }
    })
  }, [visibleNodes, busRouteIndex])

  const displayEdges = useMemo<Edge[]>(() => {
    // Token in the edge id only includes inputs that change geometry / edge type.
    // Selection-driven styling propagates through `data` and `style`, so it must NOT
    // mutate the id — otherwise old edges briefly co-exist with the new ones during
    // remount and leave stale paths behind on the canvas.
    const edgeRenderToken = `${routingStyle}`
    const selectedLogicalEdgeIds = selectedNodeId ? new Set(visibleEdges.map((edge) => edge.id)) : new Set<string>()

    const preparedEdges: Edge[] = []
    for (const edge of visibleEdges) {
      const isIncoming = selectedNodeId ? edge.target === selectedNodeId : false
      const isOutgoing = selectedNodeId ? edge.source === selectedNodeId : false
      const isConnected = isIncoming || isOutgoing

      const dependencyKind = edge.data?.dependencyKind as DependencyEdge['kind'] | undefined
      const kindColor = dependencyKind === 'type' ? '#b792ff' : dependencyKind === 're-export' ? '#59ccff' : '#7ea3bd'
      let color: string
      let strokeWidth = Math.max(Number(edge.style?.strokeWidth ?? 0), 1.4)
      const isCycleColored = String(edge.style?.stroke ?? '').startsWith('#ff')
      const strokeOpacity = 1

      if (selectedNodeId && isConnected) {
        if (edgeColorPriority === 'direction') {
          if (isOutgoing && !isIncoming) {
            color = '#f5b04d'
          } else if (isIncoming && !isOutgoing) {
            color = '#6fdc9a'
          } else {
            color = '#ffe79f'
          }
        } else {
          color = kindColor
        }
        strokeWidth = Math.max(strokeWidth, 2)
      } else if (isCycleColored) {
        color = String(edge.style?.stroke)
      } else {
        color = kindColor
      }

      const isTracedEdge = !!(edge.data as { tracedToCollapsed?: boolean } | undefined)?.tracedToCollapsed
      const baseEdge: Edge = {
        ...edge,
        id: `${edge.id}::${edgeRenderToken}`,
        type: routingStyle === 'bus' ? 'bus' : 'classicLine',
        style: {
          ...(edge.style ?? {}),
          stroke: color,
          strokeWidth: isTracedEdge ? Math.max(strokeWidth, 1.6) : strokeWidth,
          strokeDasharray: isTracedEdge ? '5 4' : undefined,
          opacity: strokeOpacity,
        },
        markerEnd:
          edge.markerEnd && typeof edge.markerEnd === 'object'
            ? { ...edge.markerEnd, color }
            : { type: 'arrowclosed' as const, color },
      }

      // Direct orthogonal routing kicks in for highlighted edges (when simplify is on)
      // and ALWAYS for traced edges (the bus router can't terminate on a folder block).
      const useDirectRouting =
        isTracedEdge || (simplifyHighlightedRoutes && isConnected && selectedNodeId !== null)
      if (useDirectRouting) {
        const sourceRect = directRouteContext.rectById.get(edge.source)
        const targetRect = directRouteContext.rectById.get(edge.target)
        if (sourceRect && targetRect) {
          const sourcePoint = {
            x: sourceRect.x + sourceRect.width,
            y: sourceRect.y + sourceRect.height / 2,
          }
          const targetPoint = { x: targetRect.x, y: targetRect.y + targetRect.height / 2 }
          const exclude = new Set<string>([
            ...directRouteContext.ancestorIds(edge.source),
            ...directRouteContext.ancestorIds(edge.target),
          ])
          const obstacles = directRouteContext.baseObstacles
            .filter((entry) => !exclude.has(entry.id))
            .map((entry) => entry.rect)
          const points = routeDirectOrthogonal(sourcePoint, targetPoint, obstacles)
          preparedEdges.push({
            ...baseEdge,
            type: 'bus',
            data: {
              ...(baseEdge.data ?? {}),
              logicalEdgeId: edge.id,
              logicalEdgeIds: [edge.id],
              segmentIds: [],
              points,
              busLane: 0,
              busCount: 1,
              isPairPrimary: true,
              pairKey: `direct:${edge.id}`,
              pairCount: 1,
              highlightedSegmentIds: [],
            },
          })
          continue
        }
        // Rect lookup failed (shouldn't happen) — fall back to bus or base edge below.
      }

      const bus = busRouteIndex.routesByEdgeId.get(edge.id) ?? null
      if (!bus) {
        preparedEdges.push(baseEdge)
        continue
      }

      preparedEdges.push({
        ...baseEdge,
        data: {
          ...(baseEdge.data ?? {}),
          logicalEdgeId: edge.id,
          logicalEdgeIds: bus.logicalEdgeIds,
          segmentIds: bus.segmentIds,
          points: bus.points,
          busLane: bus.lane,
          busCount: bus.laneCount,
          isPairPrimary: bus.isPairPrimary,
          pairKey: bus.pairKey,
          pairCount: bus.pairCount,
          highlightedSegmentIds: [],
        },
      })
    }

    if (!selectedNodeId || routingStyle !== 'bus') {
      return preparedEdges
    }

    return preparedEdges.map((edge) => {
      const segmentIds = Array.isArray(edge.data?.segmentIds) ? (edge.data.segmentIds as string[]) : []
      const highlightedSegmentIds = segmentIds.filter((segmentId) => {
        const logicalIds = busRouteIndex.segmentLogicalIds.get(segmentId)
        if (!logicalIds) {
          return false
        }
        for (const logicalId of logicalIds) {
          if (selectedLogicalEdgeIds.has(logicalId)) {
            return true
          }
        }
        return false
      })
      return {
        ...edge,
        data: {
          ...(edge.data ?? {}),
          highlightedSegmentIds,
        },
      }
    })
  }, [visibleEdges, busRouteIndex, directRouteContext, routingStyle, selectedNodeId, edgeColorPriority, simplifyHighlightedRoutes])

  useEffect(() => {
    let isCancelled = false

    async function runLayout() {
      if (!flowGraph) {
        setLayoutedNodes([])
        return
      }

      setLayoutedNodes(flowGraph.nodes)
      setIsLayouting(true)
      try {
        const nextNodes = await applyElkToBlockNodes(
          flowGraph.nodes,
          flowGraph.blockLayoutEdges,
          graphMode === 'file-level' ? 'compact' : 'dependency',
        )
        if (!isCancelled) {
          setLayoutedNodes(nextNodes)
        }
      } catch (error) {
        if (!isCancelled) {
          setLayoutedNodes(flowGraph.nodes)
          console.error('ELK layout failed, using fallback positions.', error)
        }
      } finally {
        if (!isCancelled) {
          setIsLayouting(false)
        }
      }
    }

    runLayout()
    return () => {
      isCancelled = true
    }
  }, [flowGraph, graphMode])

  // A new project resets selection/search/collapse state (path-specific), but keeps
  // display preferences (routing style, folder packing, depth mode) as they were.
  // Called from the same place `setScanResult` would have been, so the reset happens
  // imperatively instead of reactively watching `scanResult?.rootName` change.
  const handleProjectScanned = useCallback((project: ScannedProject) => {
    setScanResult(project)
    setSelectedNodeId(null)
    setDirectionFilter('all')
    setCollapsedBlockIds(new Set())
    setEdgeKindFilter('all')
    setSearchQuery('')
  }, [])

  // Same idea: routing/packing changes invalidate the current selection, so clear it
  // in the same setter call instead of a reactive effect.
  const handleSetRoutingStyle = useCallback((value: RoutingStyle) => {
    setRoutingStyle(value)
    setSelectedNodeId(null)
    setDirectionFilter('all')
  }, [])
  const handleSetFolderPacking = useCallback((value: FolderPackingMode) => {
    setFolderPacking(value)
    setSelectedNodeId(null)
    setDirectionFilter('all')
  }, [])

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (graphMode === 'inter-block' && node.parentId) {
        setSelectedNodeId(node.parentId)
        return
      }
      setSelectedNodeId(node.id)
    },
    [graphMode],
  )

  const selectedFilePath = useMemo(() => {
    if (!selectedNodeId) return null
    if (selectedNodeId.startsWith('file:')) return selectedNodeId.slice('file:'.length)
    return null
  }, [selectedNodeId])
  const selectedImportedFiles = useMemo(() => {
    if (!selectedFilePath || !dependencyGraph) return [] as string[]
    const set = new Set<string>()
    for (const edge of dependencyGraph.edges) {
      if (edge.fromPath === selectedFilePath) set.add(edge.toPath)
    }
    if (showExternalImports) {
      for (const edge of dependencyGraph.externalEdges) {
        if (edge.fromPath === selectedFilePath) set.add(edge.toPath)
      }
    }
    return Array.from(set).sort()
  }, [selectedFilePath, dependencyGraph, showExternalImports])
  const selectedImportedByFiles = useMemo(() => {
    if (!selectedFilePath || !dependencyGraph) return [] as string[]
    const set = new Set<string>()
    for (const edge of dependencyGraph.edges) {
      if (edge.toPath === selectedFilePath) set.add(edge.fromPath)
    }
    if (showExternalImports) {
      for (const edge of dependencyGraph.externalEdges) {
        if (edge.toPath === selectedFilePath) set.add(edge.fromPath)
      }
    }
    return Array.from(set).sort()
  }, [selectedFilePath, dependencyGraph, showExternalImports])

  function applyFolderDepthPreset(maxDepth: ManualFolderDepth) {
    if (!flowGraph || graphMode !== 'file-level') {
      return
    }
    if (maxDepth === 'any') {
      setCollapsedBlockIds(new Set())
      setSelectedNodeId(null)
      setDirectionFilter('all')
      return
    }
    const nextCollapsed = new Set<string>()
    for (const node of flowGraph.nodes) {
      if (!node.id.startsWith('block:')) {
        continue
      }
      if (getFolderDepth(node.id) > maxDepth) {
        nextCollapsed.add(node.id)
      }
    }
    setCollapsedBlockIds(nextCollapsed)
    setSelectedNodeId(null)
    setDirectionFilter('all')
  }

  function estimateVisibleNodeCountAtDepth(maxDepth: number) {
    if (!flowGraph) {
      return 0
    }

    const parentById = new Map<string, string>()
    const collapsed = new Set<string>()
    for (const node of flowGraph.nodes) {
      if (node.parentId) {
        parentById.set(node.id, node.parentId)
      }
      if (node.id.startsWith('block:') && getFolderDepth(node.id) > maxDepth) {
        collapsed.add(node.id)
      }
    }

    let visibleCount = 0
    for (const node of flowGraph.nodes) {
      let parentId = node.parentId
      let hidden = false
      while (parentId) {
        if (collapsed.has(parentId)) {
          hidden = true
          break
        }
        parentId = parentById.get(parentId)
      }
      if (!hidden) {
        visibleCount += 1
      }
    }
    return visibleCount
  }

  function applyAutoFolderDepth() {
    if (!flowGraph || graphMode !== 'file-level') {
      return
    }

    const folderDepths = flowGraph.nodes
      .filter((node) => node.id.startsWith('block:'))
      .map((node) => getFolderDepth(node.id))
    const maxFolderDepth = Math.max(1, ...folderDepths)
    const maxCandidateDepth = Math.min(maxFolderDepth, 8)
    const targetVisibleNodes = 140

    let chosenDepth = 1
    for (let depth = 1; depth <= maxCandidateDepth; depth += 1) {
      const visibleCount = estimateVisibleNodeCountAtDepth(depth)
      if (visibleCount <= targetVisibleNodes) {
        chosenDepth = depth
      } else {
        break
      }
    }

    applyFolderDepthPreset(chosenDepth)
  }

  // Unlike the resets above, this genuinely needs to react to a computed value: `flowGraph`
  // changes for many different reasons (new project, mode toggles, edge filters, ...) and
  // there's no single call site to hook an imperative reset into — it has to watch. Adjusted
  // during render (React's documented pattern for this) rather than in an effect, so the sync
  // happens before paint instead of causing an extra commit.
  const depthSyncChanged =
    depthSyncSnapshot === null ||
    depthSyncSnapshot.flowGraph !== flowGraph ||
    depthSyncSnapshot.graphMode !== graphMode ||
    depthSyncSnapshot.folderDepthMode !== folderDepthMode ||
    depthSyncSnapshot.manualFolderDepth !== manualFolderDepth

  if (depthSyncChanged) {
    setDepthSyncSnapshot({ flowGraph, graphMode, folderDepthMode, manualFolderDepth })
    if (flowGraph && graphMode === 'file-level' && folderDepthMode !== 'manual') {
      if (folderDepthMode === 'auto') {
        applyAutoFolderDepth()
      } else {
        applyFolderDepthPreset(manualFolderDepth)
      }
    }
  }

  const treeLines = useMemo(() => buildTreeLines(scanResult?.tree ?? null), [scanResult])

  const handleOpenStructure = useCallback(() => setIsStructureModalOpen(true), [])
  const handleCloseStructure = useCallback(() => setIsStructureModalOpen(false), [])

  return (
    <main className="app-shell">
      <TopBar
        scanResult={scanResult}
        setScanResult={handleProjectScanned}
        dependencyGraph={dependencyGraph}
        setDependencyGraph={setDependencyGraph}
        isDemo={isDemo}
        onOpenStructure={handleOpenStructure}
      />

      <ReactFlowProvider>
        <Board
          graphMode={graphMode}
          routingStyle={routingStyle}
          folderPacking={folderPacking}
          selectedNodeId={selectedNodeId}
          setSelectedNodeId={setSelectedNodeId}
          directionFilter={directionFilter}
          setDirectionFilter={setDirectionFilter}
          edgeKindFilter={edgeKindFilter}
          edgeColorPriority={edgeColorPriority}
          flowGraph={flowGraph}
          displayEdges={displayEdges}
          renderedNodes={renderedNodes}
          matchingFileNodeIds={matchingFileNodeIds}
          isLayouting={isLayouting}
          isCanvasLocked={isCanvasLocked}
          onNodeClick={onNodeClick}
        />

        <SettingsPanel
          graphMode={graphMode}
          setGraphMode={setGraphMode}
          showExternalImports={showExternalImports}
          setShowExternalImports={setShowExternalImports}
          simplifyHighlightedRoutes={simplifyHighlightedRoutes}
          setSimplifyHighlightedRoutes={setSimplifyHighlightedRoutes}
          traceIntoCollapsedFolders={traceIntoCollapsedFolders}
          setTraceIntoCollapsedFolders={setTraceIntoCollapsedFolders}
          highlightCycles={highlightCycles}
          setHighlightCycles={setHighlightCycles}
          selectedNodeId={selectedNodeId}
          setSelectedNodeId={setSelectedNodeId}
          directionFilter={directionFilter}
          setDirectionFilter={setDirectionFilter}
          edgeKindFilter={edgeKindFilter}
          setEdgeKindFilter={setEdgeKindFilter}
          edgeColorPriority={edgeColorPriority}
          setEdgeColorPriority={setEdgeColorPriority}
          routingStyle={routingStyle}
          setRoutingStyle={handleSetRoutingStyle}
          folderPacking={folderPacking}
          setFolderPacking={handleSetFolderPacking}
          folderDepthMode={folderDepthMode}
          setFolderDepthMode={setFolderDepthMode}
          manualFolderDepth={manualFolderDepth}
          setManualFolderDepth={setManualFolderDepth}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          collapsedBlockIds={collapsedBlockIds}
          setCollapsedBlockIds={setCollapsedBlockIds}
          fileNodeToBlockId={fileNodeToBlockId}
          flowGraph={flowGraph}
          isCanvasLocked={isCanvasLocked}
          setIsCanvasLocked={setIsCanvasLocked}
        />

        <InsightsPanel
          hotspotFiles={hotspotFiles}
          topCycleGroups={topCycleGroups}
          potentiallyDeadExportFiles={potentiallyDeadExportFiles}
          orphanRuntimeModules={orphanRuntimeModules}
          duplicateUtilityGroups={duplicateUtilityGroups}
          selectedNodeId={selectedNodeId}
          selectedFilePath={selectedFilePath}
          selectedImportedFiles={selectedImportedFiles}
          selectedImportedByFiles={selectedImportedByFiles}
          setSelectedNodeId={setSelectedNodeId}
        />
      </ReactFlowProvider>

      <StructureModal
        isOpen={isStructureModalOpen}
        onClose={handleCloseStructure}
        tree={scanResult?.tree ?? null}
        fileValueByPath={fileLocByPath}
        treeLines={treeLines}
      />
    </main>
  )
}

export default App
