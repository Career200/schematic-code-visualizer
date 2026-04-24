# UI Improvement Plan (Post-MVP)

## Goal
Move from a single-page technical prototype to a clearer multi-view UI with a compact PCB-like visual language, including chip-style file nodes and routed dependency traces.

## Product Direction
- Split the app into focused tabs (not all controls on one page).
- Keep graph readability high on medium/large repos.
- Introduce PCB-inspired styling and connection semantics:
  - imports: green
  - exports: orange
- Route edges with PCB-like feel and constrained angles (target: 45-degree step style).

## Information Architecture (Tabs)
1. `Overview`
   - Project summary cards (files, edges, unresolved external/internal, cycles).
   - Quick actions: rescan, open folder, mode presets.
   - Health indicators from smoke metrics.

2. `Board View`
   - Main interactive schematic/PCB canvas.
   - Block-level and file-level modes.
   - Search/filter controls specific to board usage.

3. `Dependencies`
   - Edge-centric inspection (top fan-in/fan-out, unresolved list, cycle list).
   - Click item to highlight on board.

4. `Diagnostics`
   - Resolver diagnostics (`unresolvedExternal`, `unresolvedInternal`, alias hits).
   - Raw analysis snapshots for debugging.

## Visual System (PCB Style)
- Node metaphor:
  - file node = chip body
  - import pins = left contacts (green accents)
  - export pins = right contacts (orange accents)
- Group metaphor:
  - block = board region with subtle copper/trace texture
  - collapsed block = compact “module package”
- Color conventions:
  - imports (incoming): green palette
  - exports (outgoing): orange palette
  - cycles: red warning overlay
  - selected path: bright highlight

## Routing Plan (45-degree PCB-like)
### Target behavior
- Avoid free-angle bezier curves for primary board mode.
- Use segmented polylines with directions constrained to:
  - horizontal
  - vertical
  - diagonal at 45 degrees
- Keep visually plausible routing with minimal overlaps.

### Implementation strategy
1. `Phase A` (fast)
   - Replace current edge renderer with polyline router:
     - source pin -> short horizontal segment
     - Manhattan backbone
     - optional 45-degree corner smoothing segments
   - Deterministic path generation per edge.

2. `Phase B` (quality)
   - Grid-based router (A* or Lee-like variant) over occupancy map:
     - obstacle avoidance around chips/blocks
     - cost penalties for crossings and excessive bends
     - movement set includes 8 directions (45-degree capable)

3. `Phase C` (refinement)
   - Bundle parallel routes between same block pairs.
   - Add lane spacing and layer-like offsets.
   - Optional “autoroute quality” presets: Fast / Balanced / Clean.

## Technical Work Breakdown
1. `Navigation shell`
   - Add top tab bar and stateful routing (`Overview`, `Board`, `Dependencies`, `Diagnostics`).
   - Move existing controls into appropriate tabs.

2. `Board node redesign`
   - Create custom React Flow node component for chip-style files.
   - Add left/right pin rails derived from import/export counts.

3. `Edge system redesign`
   - Introduce custom edge type with polyline path API.
   - Add color coding by direction semantics.
   - Add 45-degree routing constraints.

4. `Panel ecosystem`
   - Right-side inspector (selected node/edge details).
   - Dependency list with click-to-focus.

5. `Performance safeguards`
   - Keep routing in worker-friendly utilities for large graphs where needed.
   - Cache computed routes by graph hash + layout version.

## UX Rules
- No overloaded single screen.
- Each tab has one primary task.
- Board interactions should remain fluid under typical project sizes.
- Controls should be contextual to active tab.

## Acceptance Criteria
1. App has 4 working tabs with clear separation of responsibilities.
2. Board nodes visually resemble chips with side contacts for imports/exports.
3. Imports are green, exports orange, consistently across edges and legends.
4. Board mode edge routing no longer uses free-angle curves.
5. Routing supports 45-degree step segments and avoids most node overlaps.
6. Existing filters/search/cycle highlighting still work.
7. Build passes and smoke script remains green.

## Risks
- True PCB-grade autorouting complexity is high; keep scope progressive.
- 45-degree routing can increase path length; need readability tuning.
- Large graphs may require route caching and progressive rendering.

## Execution Order Recommendation
1. Tabs + IA split.
2. Chip-style nodes + color system.
3. Custom polyline edges (Phase A).
4. Diagnostics/dependencies tab integration.
5. Advanced router (Phase B/C) if needed after usability check.
