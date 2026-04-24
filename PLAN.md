# Schematic Code Visualizer - Plan (MVP v1)

## Status
- MVP status: **Completed** (2026-04-24)
- Smoke report: `SMOKE_RESULTS.md`

## Goal
Build a web app that analyzes a selected TypeScript project folder and visualizes file structure and import/export relationships as an electronic-style schematic.

## Scope (Iteration 1)
- Language support: TypeScript (`.ts`, `.tsx`) only.
- Folder selection in browser (File System Access API).
- Parse files and build dependency graph from imports/exports.
- Visualize graph with folder-based logical blocks (PCB sections).
- Basic filters and interaction for readability.

## Core Concepts
- File = component (chip/symbol).
- Import/export relation = wiring/trace.
- Directory = logical board block (cluster).

## Architecture
1. Scanner
   - Traverse selected folder.
   - Include: `**/*.ts`, `**/*.tsx`.
   - Exclude: `node_modules`, `dist`, `build`, `.git`.

2. Analyzer
   - Parse TS/TSX via TypeScript Compiler API.
   - Extract:
     - static imports (`import ... from '...'`)
     - re-exports (`export ... from '...'`)
     - local exports (`export const`, `export function`, etc.)
   - Resolve local relative paths.

3. Graph Builder
   - Nodes:
     - `BlockNode` (directory cluster)
     - `FileNode` (file component)
   - Edges:
     - `import` edges file-to-file
     - aggregated inter-block edges (optional overlay)

4. Renderer
   - React Flow for graph rendering.
   - ELK layout:
     - first pass: block-level layout
     - second pass: file layout inside each block
   - Visual style: PCB-inspired colors, traces, ports.

## Layout Rules for Logical Blocks
- Top-level directories under `src` become primary blocks.
- Nested directories become sub-blocks (max depth 2-3 in MVP).
- Intra-block edges are light and thin.
- Inter-block edges are thicker and higher contrast.
- Many edges between two blocks can be bundled into one channel with a counter.

## UX (MVP)
- Select folder button.
- Main canvas with pan/zoom.
- Hover node: show path + exports.
- Click node: highlight incoming/outgoing edges.
- Toggles:
  - Collapse/Expand block
  - Show only inter-block edges
  - Highlight cycles
  - Search file by name

## Data Model (Draft)
- `BlockNode`
  - `id`, `name`, `path`, `parentBlockId`, `childrenBlockIds`, `fileIds`
- `FileNode`
  - `id`, `name`, `path`, `blockId`, `exports[]`, `importCount`, `exportCount`
- `GraphEdge`
  - `id`, `fromFileId`, `toFileId`, `fromBlockId`, `toBlockId`, `type`

## Technical Stack
- Vite + React + TypeScript
- `reactflow`
- `elkjs`
- `typescript`

## Implementation Roadmap
1. Project scaffold (Vite + React + TS). ✅
2. Folder picker + scanner. ✅
3. TS analyzer (imports/exports extraction). ✅
4. Graph generation (file nodes + edges). ✅
5. Block clustering by directories. ✅
6. ELK layout integration. ✅
7. PCB-style rendering + interactions. ✅
8. Filters/search/cycle highlighting. ✅
9. Smoke test on 2-3 TS repos. ✅

## Risks and Decisions
- Browser support for folder API is limited (best in Chromium).
- Path alias resolution (`tsconfig` `baseUrl/paths`) may be partial in MVP.
- Dynamic imports are out of scope for first iteration.

## Definition of Done (MVP)
- User selects a TS project folder.
- App renders file components grouped by directory blocks.
- Import/export relations are visible and navigable.
- Inter-block architecture can be inspected clearly.

## Post-MVP Focus
- Improve resolver for repo-specific internal unresolved patterns.
- Continue UI polish (readability, interaction ergonomics, visual hierarchy).

## Post-MVP Roadmap (Code Analysis Expansion)

### Phase 1 — Code Health (MVP)
- Add a compact **Code Health** section in `Diagnostics`:
  - Hotspots (highest fan-in/fan-out + LOC-weighted signal)
  - Potential dead exports (exporting files without internal consumers)
  - Top cycles (largest SCC groups)
- Keep this phase read-only with simple lists and counters.

### Phase 2 — Dependency Quality
- Classify edges by intent:
  - runtime import
  - type-only import
  - re-export
  - dynamic import (best-effort)
- Add filters for edge type and severity.
- Add simple “risk score” per file/block.

### Phase 3 — Architecture Rules
- Introduce configurable layers/zones (`ui`, `domain`, `infra`, etc.).
- Validate dependency direction rules and show violations.
- Provide quick jump from violation -> file(s) in Board view.

### Phase 4 — Refactor Signals
- Duplicate utility candidates (name/path/content heuristics).
- Orphan module detection (no incoming, no runtime side effects heuristics).
- Re-export chains and facade bottleneck detection.

### Phase 5 — Change Intelligence (Optional)
- Git-aware hotspot overlay (churn + dependency centrality).
- Compare two refs/branches and show structural diff in graph.
- Export report (`JSON`/`Markdown`) for CI artifact usage.
