import { MiniMap } from '@xyflow/react'
import { memo } from 'react'
import { usePersistedBoolean } from '../../lib/use-persisted-boolean'
import type { InsightsPanelProps } from './types'

// Neutralizes react-flow's Panel absolute positioning so the minimap flows as a normal
// flex sibling of the insights card (see InsightsPanel/SettingsPanel DOM restructuring).
const MINIMAP_INLINE_STYLE = { position: 'static' as const, inset: 'auto', margin: 0 }

function InsightsPanelImpl({
  hotspotFiles,
  topCycleGroups,
  potentiallyDeadExportFiles,
  selectedNodeId,
  selectedFilePath,
  selectedImportedFiles,
  selectedImportedByFiles,
  setSelectedNodeId,
}: InsightsPanelProps) {
  const [isOpen, setIsOpen] = usePersistedBoolean('scv.insightsPanel.open', true)

  return (
    <div className="overlay-group overlay-group-right">
      <aside className={`overlay-card${isOpen ? '' : ' is-collapsed'}`}>
      <button
        type="button"
        className="overlay-panel-toggle"
        onClick={() => setIsOpen((previous) => !previous)}
        title={isOpen ? 'Collapse insights' : 'Expand insights'}
      >
        {isOpen ? '›' : '‹'}
      </button>
      {isOpen && (
        <div className="overlay-panel-body">
          <div className="insights-scroll">
            <div className="section-card">
              <h2>Hotspots</h2>
              {hotspotFiles.length > 0 ? (
                <ul className="quick-action-list">
                  {hotspotFiles.map((item) => (
                    <li key={`hotspot-${item.path}`}>
                      <code>{item.path}</code>
                      <span className="insight-meta">
                        in {item.incoming} / out {item.outgoing} / loc {item.loc}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="canvas-selected-io-empty">none</p>
              )}
            </div>

            <div className="section-card">
              <h2>Cycles</h2>
              {topCycleGroups.length > 0 ? (
                <ul className="quick-action-list">
                  {topCycleGroups.map((group) => (
                    <li key={`cycle-${group.id}`}>
                      <span className="insight-meta">{group.size} files</span>
                      <code>{group.filePaths.join(' -> ')}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="canvas-selected-io-empty">none</p>
              )}
            </div>

            <div className="section-card">
              <h2>Dead exports</h2>
              {potentiallyDeadExportFiles.length > 0 ? (
                <ul className="quick-action-list">
                  {potentiallyDeadExportFiles.map((file) => (
                    <li key={`dead-${file.path}`}>
                      <code>{file.path}</code>
                      <span className="insight-meta">{file.exports.length} unused export(s)</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="canvas-selected-io-empty">none</p>
              )}
            </div>
          </div>

          <div className="section-card insights-selected-card">
            <h2>Selected file</h2>
            {selectedFilePath ? (
              <div className="canvas-selected-io">
                <div className="canvas-selected-io-col">
                  <h4 title="Files this file imports">Imports ({selectedImportedFiles.length})</h4>
                  {selectedImportedFiles.length > 0 ? (
                    <ul>
                      {selectedImportedFiles.map((path) => (
                        <li key={`imp-${path}`} title={path} onClick={() => setSelectedNodeId(`file:${path}`)}>
                          {path}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="canvas-selected-io-empty">none</p>
                  )}
                </div>
                <div className="canvas-selected-io-col">
                  <h4 title="Files that import this file">Used by ({selectedImportedByFiles.length})</h4>
                  {selectedImportedByFiles.length > 0 ? (
                    <ul>
                      {selectedImportedByFiles.map((path) => (
                        <li key={`impby-${path}`} title={path} onClick={() => setSelectedNodeId(`file:${path}`)}>
                          {path}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="canvas-selected-io-empty">none</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="canvas-selected-io-empty">
                {selectedNodeId ? 'Select a file node to see incoming and outgoing imports.' : 'No file selected.'}
              </p>
            )}
          </div>
        </div>
      )}
      </aside>
      <div className="overlay-side-tool">
        <MiniMap
          style={MINIMAP_INLINE_STYLE}
          pannable
          zoomable
          nodeColor="#335f82"
          bgColor="rgba(4, 16, 29, 0.92)"
          maskColor="rgba(2, 9, 16, 0.72)"
        />
      </div>
    </div>
  )
}

export const InsightsPanel = memo(InsightsPanelImpl)
