# UI Improvement Plan (Value-First)

## Goal
Improve readability and usability first, then add visual polish.  
Routing scope is intentionally simplified: **single-layer traces + bus-style grouping**, no CAD-grade autorouter.

## Product Decisions (Locked)
- Work from highest value to lower value.
- Keep one routing layer.
- Edge crossings are acceptable.
- Prioritize readable flow/buses over perfect geometric optimization.
- Do not build a full Altium-like routing engine.

## Priority Roadmap

### P1 (Highest Value): App Structure and Focused Screens
1. Add top tabs:
   - `Overview`
   - `Board`
   - `Dependencies`
   - `Diagnostics`
2. Move controls out of one long page into contextual tabs.
3. Keep current functionality intact (search, cycles, mode switches).

**Value:** big UX clarity gain with low technical risk.

### P2: Board Readability Upgrade (Chip Nodes + Semantics)
1. Custom file nodes styled as chips.
2. Left side pins for imports, right side pins for exports.
3. Color convention:
   - imports: green
   - exports: orange
4. Add a small legend on board view.

**Value:** immediate visual comprehension of dependency direction.

### P3: Single-Layer Bus Routing (No Full Autorouter)
1. Replace free-angle/bezier look with segmented polyline edges.
2. Use constrained steps (horizontal/vertical + optional 45-degree turns).
3. Group multiple same-direction edges into shared channels (buses):
   - block-to-block bus trunks
   - fan-in/fan-out branches near nodes
4. Keep deterministic routing and stable layout between rerenders.

**Value:** large readability jump without heavy algorithmic complexity.

### P4: Board Interaction Polish
1. Right inspector panel:
   - selected node path
   - imports/exports list
   - unresolved details
2. Stronger focus mode for selected path.
3. Better collapsed-block UX (counts, mini-summary).

**Value:** improves day-to-day analysis workflow.

### P5 (Lower Value): Performance and Refinements
1. Route caching by graph hash.
2. Optional quality presets for bus spacing.
3. Visual polish (textures, subtle PCB background details).

**Value:** good enhancements after core UX is solid.

## Routing Scope (Detailed)

### In Scope
- Single-layer trace rendering.
- Bus channels between logical blocks.
- 45-degree-friendly segmenting for visual style.
- Basic overlap reduction heuristics.

### Out of Scope
- Multi-layer routing.
- Full obstacle-avoiding CAD optimization.
- Crossing-free guarantees.
- Net-class / electrical-rule style constraints.

## Acceptance Criteria
1. App is split into 4 tabs with clear responsibilities.
2. File nodes are chip-like with left import pins and right export pins.
3. Imports are green, exports are orange everywhere on board.
4. Board uses bus-oriented polyline routing (single layer).
5. Existing analysis features remain functional.
6. Build passes and smoke checks remain green.

## Implementation Order (Execution)
1. Tabs and navigation shell.
2. Chip node design + legend + pin semantics.
3. Single-layer bus renderer.
4. Inspector and interaction polish.
5. Perf/refinement pass.
