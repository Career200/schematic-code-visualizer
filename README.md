# Schematic Code Visualizer

Scans a TypeScript project's folder and turns it into a board-like, schematic-style diagram: files as components, imports as routing, folders as logical blocks.

**[Try it live](https://career200.github.io/schematic-code-visualizer/)**

## Requirements

A Chromium-based browser (Chrome, Edge, Opera, Arc, ...). Folder selection relies on the File System Access API, which Firefox and Safari don't support — the page still loads there, but you'll only see the built-in demo project.

Nothing is uploaded anywhere: the folder you pick is read locally in your browser and never leaves your machine.

## Using it

1. Open the link above — it loads with a demo project so you can see how it looks right away.
2. Click **Select Project Folder** and pick a local TypeScript project.
3. Click a file to see what it imports and what imports it back; the graph highlights the connected files.
4. Collapse folders, switch routing/layout style, search for a file, filter by dependency type — the panels on either side of the canvas cover it, and hovering a control shows what it does.

## Features

- **File-level or folder-level view** — drill into individual files, or zoom out to see just top-level folders and how they connect.
- **Click-through navigation** — select a file to see its imports and who imports it back, with the graph highlighting the connected path.
- **Search and filters** — jump to a file by name/path, filter edges by type (runtime / type-only / re-export), filter by import direction.
- **Cycle detection** — circular dependencies are found and highlighted on the graph.
- **Insights panel** — hotspots (most-connected files), potential dead exports, orphaned modules, and duplicate utility files, computed automatically from the scan.
- **Folder collapsing** — collapse noisy folders down to a single block, or let depth auto-adjust to keep the graph readable as project size grows.
- **Structure view** — a treemap/dendrogram/tree overview of the folder, sized by file count or lines of code.
- **External dependencies** — third-party imports are grouped into their own block instead of cluttering the graph.

## Run it locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (typically `http://localhost:5173`).
