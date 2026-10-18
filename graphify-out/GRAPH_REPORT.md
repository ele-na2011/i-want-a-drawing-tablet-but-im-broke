# Graph Report - placeholder  (2026-10-17)

## Corpus Check
- 31 files · ~16,418 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 4, .css 3, .ini 1)

## Summary
- 202 nodes · 347 edges · 13 communities (8 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `69d15b45`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.tsx
- compilerOptions
- package.json
- compilerOptions
- projects.ts
- SignIn.tsx
- App.tsx
- .oxlintrc.json
- Home.tsx
- tsconfig.json
- CLAUDE.md
- README.md

## God Nodes (most connected - your core abstractions)
1. `App()` - 28 edges
2. `compilerOptions` - 18 edges
3. `compilerOptions` - 15 edges
4. `react` - 9 edges
5. `renderPage()` - 7 edges
6. `beginStroke()` - 7 edges
7. `Stroke` - 7 edges
8. `scripts` - 6 edges
9. `loadStore()` - 6 edges
10. `addProject()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `DrawingCanvas()`  [EXTRACTED]
  inkless/src/App.tsx → inkless/src/components/DrawingCanvas.tsx
- `App()` --calls--> `Home()`  [EXTRACTED]
  inkless/src/App.tsx → inkless/src/components/Home.tsx
- `App()` --calls--> `PageView()`  [EXTRACTED]
  inkless/src/App.tsx → inkless/src/components/PageView.tsx
- `App()` --calls--> `SettingsDialog()`  [EXTRACTED]
  inkless/src/App.tsx → inkless/src/components/SettingsDialog.tsx
- `App()` --calls--> `SignIn()`  [EXTRACTED]
  inkless/src/App.tsx → inkless/src/components/SignIn.tsx

## Import Cycles
- None detected.

## Communities (13 total, 5 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.14
Nodes (18): DENSITY, DrawingCanvas(), Props, LABELS, downloadPdf(), Page, readImage(), thumbnail() (+10 more)

### Community 1 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 2 - "package.json"
Cohesion: 0.06
Nodes (32): dependencies, @mediapipe/tasks-vision, perspective-transform, react, react-dom, devDependencies, oxlint, @types/node (+24 more)

### Community 3 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 4 - "projects.ts"
Cohesion: 0.13
Nodes (21): Home(), clamp(), PageView(), addDoc(), addFolder(), addProject(), allPlaces(), childFolders() (+13 more)

### Community 7 - "App.tsx"
Cohesion: 0.14
Nodes (20): App(), keyPlace(), placeKey(), Ask, AskDialog(), COLORS, Props, Tool (+12 more)

### Community 8 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 10 - "Home.tsx"
Cohesion: 0.11
Nodes (8): Props, SettingsDialog(), USER, Place, Store, CameraStatus, react, react-dom

## Knowledge Gaps
- **7 isolated node(s):** `@mediapipe/tasks-vision`, `perspective-transform`, `@types/node`, `@types/react`, `@types/react-dom` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 103 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Home.tsx` to `App.tsx`, `package.json`, `projects.ts`, `App.tsx`?**
  _High betweenness centrality (0.207) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `redo()` and `undo()`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@mediapipe/tasks-vision`, `perspective-transform`, `@types/node` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14333333333333334 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._