import { useMemo } from 'react'
import type { TreeNode } from '../lib/models'

export type StructureViewMode = 'treemap' | 'dendrogram' | 'tree'
export type TreemapMetricMode = 'files' | 'loc'

type ProjectStructureVizProps = {
  tree: TreeNode | null
  mode: StructureViewMode
  treemapMetric: TreemapMetricMode
  fileValueByPath?: Map<string, number>
  treeLines?: string[]
}

type MetricNode = {
  node: TreeNode
  value: number
  children: MetricNode[]
}

type TreemapRect = {
  id: string
  label: string
  type: TreeNode['type']
  depth: number
  x: number
  y: number
  width: number
  height: number
}

type DendroPoint = {
  id: string
  label: string
  type: TreeNode['type']
  depth: number
  x: number
  y: number
}

type DendroLink = {
  id: string
  fromX: number
  fromY: number
  toX: number
  toY: number
}

const SVG_WIDTH = 980
const SVG_HEIGHT = 520
const PADDING = 12

function buildMetricTree(node: TreeNode, fileValueByPath?: Map<string, number>): MetricNode {
  if (node.type === 'file') {
    return { node, value: Math.max(1, fileValueByPath?.get(node.path) ?? 1), children: [] }
  }
  const children: MetricNode[] = (node.children ?? []).map((child) => buildMetricTree(child, fileValueByPath))
  const sum = children.reduce((accumulator: number, child: MetricNode) => accumulator + child.value, 0)
  return { node, value: Math.max(1, sum), children }
}

function layoutTreemap(metricNode: MetricNode) {
  const rectangles: TreemapRect[] = []

  function walk(node: MetricNode, x: number, y: number, width: number, height: number, depth: number, horizontal: boolean) {
    if (width < 2 || height < 2) {
      return
    }
    rectangles.push({
      id: node.node.path,
      label: node.node.name,
      type: node.node.type,
      depth,
      x,
      y,
      width,
      height,
    })

    if (node.children.length === 0) {
      return
    }

    const total = node.children.reduce((accumulator, child) => accumulator + child.value, 0)
    let offset = 0
    for (const child of node.children) {
      const ratio = child.value / total
      if (horizontal) {
        const childWidth = width * ratio
        walk(child, x + offset, y, childWidth, height, depth + 1, !horizontal)
        offset += childWidth
      } else {
        const childHeight = height * ratio
        walk(child, x, y + offset, width, childHeight, depth + 1, !horizontal)
        offset += childHeight
      }
    }
  }

  walk(metricNode, PADDING, PADDING, SVG_WIDTH - PADDING * 2, SVG_HEIGHT - PADDING * 2, 0, true)
  return rectangles
}

function layoutDendrogram(root: TreeNode) {
  const points: DendroPoint[] = []
  const links: DendroLink[] = []

  let leafIndex = 0
  let maxDepth = 0

  function countDepth(node: TreeNode, depth: number) {
    maxDepth = Math.max(maxDepth, depth)
    for (const child of node.children ?? []) {
      countDepth(child, depth + 1)
    }
  }
  countDepth(root, 0)

  const leaves: TreeNode[] = []
  function collectLeaves(node: TreeNode) {
    const children = node.children ?? []
    if (children.length === 0) {
      leaves.push(node)
      return
    }
    for (const child of children) {
      collectLeaves(child)
    }
  }
  collectLeaves(root)
  const leafCount = Math.max(1, leaves.length)

  const xStep = (SVG_WIDTH - PADDING * 2) / Math.max(1, leafCount - 1)
  const yStep = (SVG_HEIGHT - PADDING * 2) / Math.max(1, maxDepth)

  function walk(node: TreeNode, depth: number): { x: number; y: number } {
    const children = node.children ?? []
    let x: number
    if (children.length === 0) {
      x = PADDING + leafIndex * xStep
      leafIndex += 1
    } else {
      const childPoints = children.map((child) => walk(child, depth + 1))
      x = childPoints.reduce((accumulator, point) => accumulator + point.x, 0) / childPoints.length
      for (const childPoint of childPoints) {
        links.push({
          id: `${node.path}->${childPoint.x}:${childPoint.y}`,
          fromX: x,
          fromY: PADDING + depth * yStep,
          toX: childPoint.x,
          toY: childPoint.y,
        })
      }
    }

    const y = PADDING + depth * yStep
    points.push({
      id: node.path,
      label: node.name,
      type: node.type,
      depth,
      x,
      y,
    })

    return { x, y }
  }

  walk(root, 0)
  return { points, links }
}

export function ProjectStructureViz({ tree, mode, treemapMetric, fileValueByPath, treeLines = [] }: ProjectStructureVizProps) {
  const metricTree = useMemo(
    () => (tree ? buildMetricTree(tree, treemapMetric === 'loc' ? fileValueByPath : undefined) : null),
    [tree, treemapMetric, fileValueByPath],
  )
  const treemap = useMemo(() => (metricTree ? layoutTreemap(metricTree) : []), [metricTree])
  const dendrogram = useMemo(() => (tree ? layoutDendrogram(tree) : { points: [], links: [] }), [tree])
  // LOC per path, independent of `treemapMetric` — used for the hover tooltip regardless of what sizes the rects.
  const locByPath = useMemo(() => {
    const map = new Map<string, number>()
    if (!tree || !fileValueByPath) {
      return map
    }
    const walk = (node: MetricNode) => {
      map.set(node.node.path, node.value)
      for (const child of node.children) {
        walk(child)
      }
    }
    walk(buildMetricTree(tree, fileValueByPath))
    return map
  }, [tree, fileValueByPath])

  if (!tree) {
    return (
      <div className="structure-view-frame">
        <div className="overview-viz-empty">Select a folder to render structure view.</div>
      </div>
    )
  }

  if (mode === 'tree') {
    return (
      <div className="structure-view-frame">
        <div className="tree">
          <pre>{treeLines.length > 0 ? treeLines.join('\n') : 'Select a folder to scan.'}</pre>
        </div>
      </div>
    )
  }

  return (
    <div className="structure-view-frame">
      <div className="overview-viz-shell">
      <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="overview-viz-svg" role="img">
        {mode === 'treemap' ? (
          <>
            {treemap.map((rect) => {
              const fontSize = rect.depth === 0 ? 13 : 11
              const canLabel = rect.width > 90 && rect.height > 30
              return (
                <g key={rect.id}>
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={Math.max(0, rect.width - 1)}
                    height={Math.max(0, rect.height - 1)}
                    className={rect.type === 'directory' ? 'overview-rect-dir' : 'overview-rect-file'}
                  >
                    <title>
                      {rect.id}
                      {locByPath.has(rect.id) ? ` — ${locByPath.get(rect.id)} loc` : ''}
                    </title>
                  </rect>
                  {canLabel ? (
                    <text x={rect.x + 6} y={rect.y + 16} fontSize={fontSize} className="overview-viz-label">
                      {rect.label}
                    </text>
                  ) : null}
                </g>
              )
            })}
          </>
        ) : (
          <>
            {dendrogram.links.map((link) => (
              <line
                key={link.id}
                x1={link.fromX}
                y1={link.fromY}
                x2={link.toX}
                y2={link.toY}
                className="overview-dendro-link"
              />
            ))}
            {dendrogram.points.map((point) => (
              <g key={point.id}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={point.type === 'directory' ? 4 : 2.8}
                  className={point.type === 'directory' ? 'overview-dendro-dir' : 'overview-dendro-file'}
                />
                {point.depth <= 2 ? (
                  <text x={point.x + 6} y={point.y - 6} className="overview-viz-label overview-dendro-label">
                    {point.label}
                  </text>
                ) : null}
              </g>
            ))}
          </>
        )}
      </svg>
      </div>
    </div>
  )
}
