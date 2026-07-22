import { memo, useState } from 'react'
import type { TreeNode } from '../../lib/models'
import { ProjectStructureViz, type StructureViewMode, type TreemapMetricMode } from '../ProjectStructureViz'

type StructureModalProps = {
  isOpen: boolean
  onClose: () => void
  tree: TreeNode | null
  fileValueByPath: Map<string, number>
  treeLines: string[]
}

function StructureModalImpl({ isOpen, onClose, tree, fileValueByPath, treeLines }: StructureModalProps) {
  const [mode, setMode] = useState<StructureViewMode>('treemap')
  const [treemapMetric, setTreemapMetric] = useState<TreemapMetricMode>('files')

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-shell" onClick={(event) => event.stopPropagation()}>
        <div className="structure-modal-header">
          <h2>Structure View</h2>
          <div className="structure-modal-controls">
            <label className="toggle-row">
              View
              <select value={mode} onChange={(event) => setMode(event.target.value as StructureViewMode)}>
                <option value="treemap">treemap</option>
                <option value="dendrogram">dendrogram</option>
                <option value="tree">tree</option>
              </select>
            </label>
            <label className="toggle-row">
              Size
              <select
                value={treemapMetric}
                onChange={(event) => setTreemapMetric(event.target.value as TreemapMetricMode)}
                disabled={mode !== 'treemap'}
              >
                <option value="files">files</option>
                <option value="loc">loc</option>
              </select>
            </label>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Close" aria-label="Close" />
        </div>
        <ProjectStructureViz
          tree={tree}
          mode={mode}
          treemapMetric={treemapMetric}
          fileValueByPath={fileValueByPath}
          treeLines={treeLines}
        />
      </div>
    </div>
  )
}

export const StructureModal = memo(StructureModalImpl)
