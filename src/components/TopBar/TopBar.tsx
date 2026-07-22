import { memo, useState } from 'react'
import { analyzeProjectDependenciesInWorker } from '../../lib/analyzer-worker-client'
import type { DependencyGraph, ScannedProject } from '../../lib/models'
import { scanProjectFolder } from '../../lib/scanner'
import { readTsConfigAliasConfig } from '../../lib/tsconfig-reader'

type TopBarProps = {
  scanResult: ScannedProject | null
  setScanResult: (value: ScannedProject) => void
  dependencyGraph: DependencyGraph | null
  setDependencyGraph: (value: DependencyGraph) => void
  isDemo: boolean
  onOpenStructure: () => void
}

function TopBarImpl({ scanResult, setScanResult, dependencyGraph, setDependencyGraph, isDemo, onOpenStructure }: TopBarProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const isBusy = isScanning || isAnalyzing
  const isPickerAvailable = typeof window !== 'undefined' && 'showDirectoryPicker' in window

  function pickButtonLabel() {
    if (isScanning) return 'Scanning files...'
    if (isAnalyzing) return 'Analyzing dependencies...'
    return 'Select Project Folder'
  }

  async function handlePickDirectory() {
    if (!isPickerAvailable) {
      setErrorMessage('Your browser does not support File System Access API (use Chromium-based browser).')
      return
    }
    setIsScanning(true)
    setIsAnalyzing(false)
    setErrorMessage(null)
    try {
      const directoryHandle = await window.showDirectoryPicker({ mode: 'read' })
      const scannedProject = await scanProjectFolder(directoryHandle)
      const tsconfigAliases = await readTsConfigAliasConfig(directoryHandle)
      setScanResult(scannedProject)
      setIsAnalyzing(true)
      const graph = await analyzeProjectDependenciesInWorker(scannedProject.files, {
        rootName: scannedProject.rootName,
        tsconfigAliases,
      })
      setDependencyGraph(graph)
    } catch (error) {
      if ((error as DOMException).name === 'AbortError') return
      setErrorMessage('Failed to scan or analyze the selected directory.')
      console.error(error)
    } finally {
      setIsScanning(false)
      setIsAnalyzing(false)
    }
  }

  return (
    <header className="top-bar">
      <div className="top-bar-brand">
        <span className="top-bar-title">Schematic Code Visualizer</span>
        <span className="top-bar-project" title={scanResult?.rootName ?? ''}>
          {isDemo ? 'Demo project' : scanResult?.rootName ?? '-'}
          {scanResult && (
            <span className="top-bar-project-stats">
              {' '}
              — {scanResult.tsFileCount} files, {dependencyGraph?.edges.length ?? 0} edges
            </span>
          )}
        </span>
      </div>
      <div className="top-bar-actions">
        {errorMessage && <span className="error top-bar-error">{errorMessage}</span>}
        <button type="button" onClick={onOpenStructure} disabled={!scanResult}>
          Structure
        </button>
        <button type="button" onClick={handlePickDirectory} disabled={isBusy}>
          {pickButtonLabel()}
        </button>
        <span
          className="top-bar-info"
          tabIndex={0}
          onMouseEnter={() => setIsAboutOpen(true)}
          onMouseLeave={() => setIsAboutOpen(false)}
          onFocus={() => setIsAboutOpen(true)}
          onBlur={() => setIsAboutOpen(false)}
        >
          ⓘ
          {isAboutOpen && (
            <div className="top-bar-tooltip">
              <strong>Schematic Code Visualizer</strong>
              <p>
                Scans a local TypeScript project and renders its structure + dependency graph as a board-like,
                schematic-style diagram. Files behave like components, imports like routing, folders like logical
                blocks.
              </p>
            </div>
          )}
        </span>
      </div>
    </header>
  )
}

export const TopBar = memo(TopBarImpl)
