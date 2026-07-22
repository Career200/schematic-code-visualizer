import { memo, useMemo } from 'react'
import { CanvasNavWheel } from '../CanvasNavWheel'
import { getFolderDepth } from '../../utils/get-folder-depth'
import { usePersistedBoolean } from '../../lib/use-persisted-boolean'
import type { SettingsPanelProps } from './types'

function SettingsPanelImpl({
  graphMode,
  setGraphMode,
  showExternalImports,
  setShowExternalImports,
  simplifyHighlightedRoutes,
  setSimplifyHighlightedRoutes,
  traceIntoCollapsedFolders,
  setTraceIntoCollapsedFolders,
  highlightCycles,
  setHighlightCycles,
  selectedNodeId,
  setSelectedNodeId,
  directionFilter,
  setDirectionFilter,
  edgeKindFilter,
  setEdgeKindFilter,
  edgeColorPriority,
  setEdgeColorPriority,
  routingStyle,
  setRoutingStyle,
  folderPacking,
  setFolderPacking,
  folderDepthMode,
  setFolderDepthMode,
  manualFolderDepth,
  setManualFolderDepth,
  searchQuery,
  setSearchQuery,
  collapsedBlockIds,
  setCollapsedBlockIds,
  fileNodeToBlockId,
  flowGraph,
  isCanvasLocked,
  setIsCanvasLocked,
}: SettingsPanelProps) {
  const [isOpen, setIsOpen] = usePersistedBoolean('scv.settingsPanel.open', true)

  const selectedBlockId = useMemo(() => {
    if (!selectedNodeId) return null
    if (selectedNodeId.startsWith('block:')) return selectedNodeId
    return fileNodeToBlockId.get(selectedNodeId) ?? null
  }, [selectedNodeId, fileNodeToBlockId])

  const collapsibleBlockIds = useMemo(() => {
    const ids = new Set<string>()
    for (const node of flowGraph?.nodes ?? []) {
      if (!node.id.startsWith('block:')) continue
      if (getFolderDepth(node.id) > 0) ids.add(node.id)
    }
    return ids
  }, [flowGraph])

  const areAllFoldersCollapsed = useMemo(() => {
    if (collapsibleBlockIds.size === 0) return false
    for (const blockId of collapsibleBlockIds) {
      if (!collapsedBlockIds.has(blockId)) return false
    }
    return true
  }, [collapsibleBlockIds, collapsedBlockIds])

  function toggleSelectedBlockCollapse() {
    if (!selectedBlockId || graphMode !== 'file-level') return
    setFolderDepthMode('manual')
    setCollapsedBlockIds((previous) => {
      const next = new Set(previous)
      if (next.has(selectedBlockId)) next.delete(selectedBlockId)
      else next.add(selectedBlockId)
      return next
    })
  }

  function toggleAllFoldersCollapse() {
    if (graphMode !== 'file-level' || collapsibleBlockIds.size === 0) return
    setFolderDepthMode('manual')
    if (areAllFoldersCollapsed) setCollapsedBlockIds(new Set())
    else setCollapsedBlockIds(new Set(collapsibleBlockIds))
  }

  return (
    <div className="overlay-group overlay-group-left">
      <aside className={`overlay-card${isOpen ? '' : ' is-collapsed'}`}>
      <button
        type="button"
        className="overlay-panel-toggle"
        onClick={() => setIsOpen((previous) => !previous)}
        title={isOpen ? 'Collapse settings' : 'Expand settings'}
      >
        {isOpen ? '‹' : '›'}
      </button>
      {isOpen && (
        <div className="overlay-panel-body">
          <div className="flow-header">
            <h2>Settings</h2>
            <div className="mode-switch">
              <button
                type="button"
                className={graphMode === 'file-level' ? 'is-active' : ''}
                onClick={() => setGraphMode('file-level')}
              >
                File-Level
              </button>
              <button
                type="button"
                className={graphMode === 'inter-block' ? 'is-active' : ''}
                onClick={() => setGraphMode('inter-block')}
              >
                Inter-Block
              </button>
            </div>
          </div>
          <div className="flow-controls">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={showExternalImports}
                onChange={(event) => setShowExternalImports(event.target.checked)}
              />
              Show external imports
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={simplifyHighlightedRoutes}
                onChange={(event) => setSimplifyHighlightedRoutes(event.target.checked)}
              />
              Simplify highlighted routes
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={traceIntoCollapsedFolders}
                onChange={(event) => setTraceIntoCollapsedFolders(event.target.checked)}
              />
              Trace into collapsed folders
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={highlightCycles}
                onChange={(event) => setHighlightCycles(event.target.checked)}
              />
              Highlight cycles
            </label>
            <label className="toggle-row">
              Direction
              <select
                value={directionFilter}
                onChange={(event) => setDirectionFilter(event.target.value as 'all' | 'incoming' | 'outgoing')}
                disabled={!selectedNodeId}
              >
                <option value="all">all</option>
                <option value="incoming">incoming</option>
                <option value="outgoing">outgoing</option>
              </select>
            </label>
            <label className="toggle-row">
              Edge type
              <select value={edgeKindFilter} onChange={(event) => setEdgeKindFilter(event.target.value as typeof edgeKindFilter)}>
                <option value="all">all</option>
                <option value="runtime">runtime</option>
                <option value="type">type</option>
                <option value="re-export">re-export</option>
              </select>
            </label>
            <label className="toggle-row">
              Color priority
              <select
                value={edgeColorPriority}
                onChange={(event) => setEdgeColorPriority(event.target.value as typeof edgeColorPriority)}
              >
                <option value="direction">direction</option>
                <option value="kind">kind</option>
              </select>
            </label>
            <label className="toggle-row">
              Routing
              <select value={routingStyle} onChange={(event) => setRoutingStyle(event.target.value as typeof routingStyle)}>
                <option value="classic">classic</option>
                <option value="bus">bus</option>
              </select>
            </label>
            <label className="toggle-row">
              Folder packing
              <select
                value={folderPacking}
                onChange={(event) => setFolderPacking(event.target.value as typeof folderPacking)}
                disabled={graphMode !== 'file-level'}
              >
                <option value="balanced">balanced</option>
                <option value="dense">dense</option>
              </select>
            </label>
            <label className="toggle-row">
              Auto depth
              <input
                type="checkbox"
                checked={folderDepthMode === 'auto'}
                onChange={(event) => {
                  setFolderDepthMode(event.target.checked ? 'auto' : 'preset')
                }}
                disabled={graphMode !== 'file-level' || !flowGraph}
              />
            </label>
            <label className="toggle-row">
              Depth
              <select
                value={String(manualFolderDepth)}
                onChange={(event) => {
                  const nextValue = event.target.value === 'any' ? 'any' : Number(event.target.value)
                  setManualFolderDepth(nextValue)
                  setFolderDepthMode('preset')
                }}
                disabled={graphMode !== 'file-level' || folderDepthMode === 'auto'}
              >
                <option value="any">any</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
                <option value={6}>6</option>
                <option value={7}>7</option>
                <option value={8}>8</option>
              </select>
            </label>
            <label className="toggle-row search-row">
              Search file
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="name or path"
              />
            </label>
            <div className="board-action-grid">
              <button
                type="button"
                className="board-icon-btn"
                title={selectedBlockId && collapsedBlockIds.has(selectedBlockId) ? 'Expand selected block' : 'Collapse selected block'}
                aria-label={selectedBlockId && collapsedBlockIds.has(selectedBlockId) ? 'Expand selected block' : 'Collapse selected block'}
                onClick={toggleSelectedBlockCollapse}
                disabled={graphMode !== 'file-level' || !selectedBlockId}
              >
                {selectedBlockId && collapsedBlockIds.has(selectedBlockId) ? '⤢' : '⤡'}
              </button>
              <button
                type="button"
                className="board-icon-btn"
                title={areAllFoldersCollapsed ? 'Expand all folders' : 'Collapse all folders'}
                aria-label={areAllFoldersCollapsed ? 'Expand all folders' : 'Collapse all folders'}
                onClick={toggleAllFoldersCollapse}
                disabled={graphMode !== 'file-level' || collapsibleBlockIds.size === 0}
              >
                {areAllFoldersCollapsed ? '⤢' : '⤡'}
              </button>
              <button
                type="button"
                className="board-icon-btn"
                title="Clear selection"
                aria-label="Clear selection"
                onClick={() => {
                  setSelectedNodeId(null)
                  setDirectionFilter('all')
                }}
                disabled={!selectedNodeId}
              >
                ⨯
              </button>
            </div>
          </div>
          <div className="board-legend">
            <span className="legend-item">
              <span className="legend-swatch legend-swatch-neutral" />
              Runtime edge
            </span>
            <span className="legend-item">
              <span className="legend-swatch legend-swatch-type" />
              Type edge
            </span>
            <span className="legend-item">
              <span className="legend-swatch legend-swatch-reexport" />
              Re-export edge
            </span>
            <span className="legend-item">
              <span className="legend-swatch legend-swatch-import" />
              Incoming (selected)
            </span>
            <span className="legend-item">
              <span className="legend-swatch legend-swatch-export" />
              Outgoing (selected)
            </span>
            <span className="legend-note">
              `Color priority` controls whether selected edges keep kind colors or switch to direction colors.
            </span>
          </div>
        </div>
      )}
      </aside>
      <div className="overlay-side-tool">
        <CanvasNavWheel isLocked={isCanvasLocked} onToggleLock={() => setIsCanvasLocked((previous) => !previous)} />
      </div>
    </div>
  )
}

export const SettingsPanel = memo(SettingsPanelImpl)
