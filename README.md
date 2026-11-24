# Tower Clash

**A 3D/2D Tower Defense Strategy Game powered by custom Data Structures & Algorithms, paired with a 10-module Visual DSA Laboratory and a native C++17 + TypeScript Performance Benchmarking Suite.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.187-000000?logo=threedotjs&logoColor=white)](https://threejs.org/)
[![C++17](https://img.shields.io/badge/C%2B%2B-17-00599C?logo=cplusplus&logoColor=white)](https://isocpp.org/)
[![Express](https://img.shields.io/badge/Express-v5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-003B57?logo=sqlite&logoColor=white)](https://nodejs.org/api/sqlite.html)

---

## Overview

Tower Clash combines three tightly integrated modules in a single full-stack application:

1. **Playable Tower Defense Game** (`src/engine/`, `src/pages/PlayGame.tsx`) — Real-time strategy gameplay rendered in 3D (Three.js) and 2D (Canvas), where every game mechanic runs on hand-rolled data structures rather than built-in shortcuts.
2. **DSA Algorithm Laboratory** (`src/pages/DsaLab.tsx`, `src/pages/lab/`) — Interactive 10-module visualizer with custom inputs, step-by-step playback, operation counters, and direct mappings to the game engine.
3. **Performance Analysis Dashboard** (`src/pages/PerformanceAnalysis.tsx`, `cpp/`) — Executes native C++17 benchmarks (`cpp/build/dsa_engine`) alongside in-browser TypeScript timings, recording execution time, comparisons, swaps/writes, recursive calls, and heap allocations in SQLite.

---

## Architecture

```text
+-------------------------------------------------------------------+
| React 19 + TypeScript Frontend (Vite + Tailwind CSS)              |
| - 3D Three.js & 2D Canvas Game Engine (src/engine/)               |
| - 10-Module Visual DSA Laboratory (src/dsa/ + src/pages/lab/)     |
| - Performance Charts, Suffix-Array Search, UML/DFD Modals         |
+---------------------------------+---------------------------------+
                                  | REST (/api/*)
                                  v
+-------------------------------------------------------------------+
| Node.js + Express v5 Backend (server/index.ts, server/routes/)    |
| - SQLite persistence via node:sqlite (data/dsa_defense.sqlite)    |
| - Safe child_process.execFile wrapper for native C++ benchmarks   |
+---------------------------------+---------------------------------+
                                  | argv + stdout JSON
                                  v
+-------------------------------------------------------------------+
| Native C++17 Template DSA Engine (cpp/include/, cpp/build/)       |
| - MemoryTracker counting explicit new/delete allocations          |
| - Compiled with -O2 -Wall -Wextra via cpp/Makefile                |
+-------------------------------------------------------------------+
```

---

## Core Modules

### 1. Tower Defense Game Engine (`src/engine/`)

- **4 Battlefield Maps**: `Circuit Valley`, `Red-Black Fortress`, `Sparse Matrix Basin`, and `Eulerian Citadel` with Dijkstra-verified routes, resource crystals, slow zones, and obstacles.
- **6 Polymorphic Enemy Classes**: `NormalEnemy`, `FastEnemy`, `HeavyEnemy`, `ArmoredEnemy`, `BossEnemy`, and `FlyingEnemy` extending `Enemy`.
- **6 Polymorphic Tower Classes**: `BasicTower`, `SniperTower`, `RapidTower`, `SplashTower`, `SlowTower`, and `LaserTower` extending `Tower`.
- **7 Targeting Policies**: `nearest`, `weakest`, `strongest`, `fastest`, `highest_threat`, `first_on_path`, and `last_on_path` powered by `PriorityQueue` and selectable sorting algorithms.
- **Live DSA Telemetry HUD**: Tracks queue spawns, `DoublyLinkedList` active enemies, `Stack` undo actions, `CircularQueue` periodic events, `HashTable` lookups/collisions, `QuadTree`/`KDTree` spatial pruning, and `SegmentTree` min/max enemy HP queries.

#### Engine-to-DSA Mapping

| Game Subsystem | Data Structure / Algorithm | Source |
|---|---|---|
| Battlefield Grid & Terrain | 2D Array + `SparseMatrix` overlay | `src/engine/maps.ts`, `src/dsa/linkedLists.ts` |
| Enemy Route Navigation | Dijkstra Shortest Path (`PathFinder`) | `src/engine/PathFinder.ts` |
| Wave Spawning Pipeline | FIFO `Queue<SpawnTask>` | `src/engine/WaveManager.ts`, `src/dsa/linear.ts` |
| Active Enemies on Field | `DoublyLinkedList<Enemy>` (O(1) unlink) | `src/engine/GameEngine.ts`, `src/dsa/linkedLists.ts` |
| Tower Inventory | `DynamicArray<Tower>` | `src/engine/GameEngine.ts`, `src/dsa/linear.ts` |
| Fast ID Lookup | `HashTable<Tower>` & `HashTable<Enemy>` | `src/engine/GameEngine.ts`, `src/dsa/hashing.ts` |
| Undo Placement History | LIFO `Stack<UndoAction>` | `src/engine/GameEngine.ts`, `src/dsa/linear.ts` |
| Periodic Resource/Alert Loop | `CircularQueue<PeriodicEvent>` | `src/engine/GameEngine.ts`, `src/dsa/linear.ts` |
| Tower Range Spatial Pruning | `QuadTree<Enemy>` / `KDTree<Enemy>` | `src/engine/GameEngine.ts`, `src/dsa/advancedTrees.ts` |
| Min/Max Active Enemy HP | `SegmentTree` | `src/engine/GameEngine.ts`, `src/dsa/advancedTrees.ts` |
| Smart Target Ranking | `PriorityQueue<Enemy>` + 8 Manual Sorts | `src/engine/TargetingStrategy.ts`, `src/dsa/sorting.ts` |
| Armory Search & Autocomplete | `Trie` + `HashTable` | `src/pages/TowerCollection.tsx`, `src/dsa/strings.ts` |
| Match Log Filtering | `SuffixArray` + Merge Sort | `src/pages/GameHistory.tsx`, `src/dsa/strings.ts` |

### 2. Visual DSA Laboratory (`src/pages/DsaLab.tsx`, `src/pages/lab/`)

10 interactive modules with step-by-step execution traces, custom inputs, and comparison/swap metrics:

1. **Linear Structures**: `DynamicArray`, `Stack`, `Queue`, `CircularQueue`
2. **Searching**: `Linear Search`, `Binary Search`, deterministic `Median-of-Medians Search`
3. **Sorting (8 algorithms + Compare Mode)**: `Bubble`, `Selection`, `Insertion`, `Merge`, `Quick`, `Radix`, `Bucket`, `Counting`
4. **Hashing**: `Separate Chaining`, `Linear Probing`, `Quadratic Probing`, `Double Hashing`
5. **Linked Lists & Sparse Matrix**: `SinglyLinkedList`, `DoublyLinkedList`, `CircularLinkedList`, `Multi-Linked Sparse Matrix`
6. **Trees & Heaps**: `BinaryTree`, `KaryTree`, `BST`, `ThreadedBinaryTree`, `AVLTree`, `RedBlackTree`, `BTree`, `BPlusTree`, `BinaryHeap`, `PriorityQueue`
7. **Graphs (+ Interactive Editor)**: `BFS`, `DFS`, `Dijkstra`, `Bellman-Ford`, `Floyd-Warshall`, `Prim MST`, `Kruskal MST`
8. **Backtracking**: `Rat in a Maze`, configurable `N-Queens`
9. **Spatial & Advanced Trees**: `IntervalTree`, `SegmentTree`, `RangeTree2D`, `KDTree`, `QuadTree`
10. **Strings**: `Trie`, `SuffixTree`, `SuffixArray`, `Polynomial Hash / Rabin-Karp`

### 3. C++17 & TypeScript Performance Lab (`cpp/`, `src/pages/PerformanceAnalysis.tsx`)

- Benchmarks across input sizes from `100` to `10,000` and distributions (`random`, `sorted`, `reversed`, `best`, `average`, `worst`).
- Tracks wall-clock execution time (`ms`), comparisons, swaps/writes, recursive calls, total operations, and estimated memory usage.
- Persists benchmark runs, player XP/achievements, and match history in SQLite (`data/dsa_defense.sqlite`).

---

## Getting Started

### Prerequisites

- **Node.js** `v22+` (uses built-in `node:sqlite`)
- **clang++** or **g++** with C++17 support and `make`

### Installation & Running

```bash
# 1. Install dependencies
npm install

# 2. Build the frontend bundle and native C++17 DSA engine
npm run build

# 3. Run TypeScript (Vitest) and C++17 unit tests
npm run test

# 4. Start development servers (Express API on :3001 + Vite on :5173)
npm run dev
```

To run the unified production server (serves `dist/` and `/api` on port `3001`):

```bash
npm run start
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run Express API (`:3001`) and Vite dev server (`:5173`) concurrently |
| `npm run build` | Build production React bundle (`vite build`) and C++17 binaries (`make -C cpp`) |
| `npm run build:cpp` | Compile `cpp/build/dsa_engine` and `cpp/build/test_dsa` |
| `npm run test` | Run Vitest suites and C++17 unit tests |
| `npm run test:cpp` | Compile and run C++17 unit tests with leak verification |
| `npm run start` | Start production Express server on `:3001` |

---

## Project Structure

```text
Tower Clash/
├── cpp/
│   ├── include/          # C++17 template headers (structures, algorithms, MemoryTracker)
│   ├── src/              # dsa_engine.cpp JSON CLI benchmark runner
│   ├── tests/            # C++17 unit tests & leak checks
│   └── Makefile
├── server/
│   ├── db.ts             # node:sqlite schema & initialization
│   ├── index.ts          # Express v5 server entry point
│   └── routes/api.ts     # REST endpoints (/health, /profile, /game-sessions, /benchmarks)
├── src/
│   ├── dsa/              # Manual TypeScript DSA implementations with step traces
│   ├── engine/           # 3D/2D GameEngine, Towers, Enemies, PathFinder, WaveManager
│   ├── pages/            # Dashboard, PlayGame, Maps, Armory, DSA Lab, Benchmarks, History
│   ├── components/       # Shared UI layout, charts, and UML/DFD modals
│   └── tests/            # Vitest unit tests for DSA & game engine
└── docs/
    ├── ARCHITECTURE.md
    ├── DATA_FLOW_DIAGRAM.md
    └── UML_CLASS_DIAGRAM.md
```

---

## Documentation

- [System Architecture](docs/ARCHITECTURE.md)
- [Data Flow Diagram](docs/DATA_FLOW_DIAGRAM.md)
- [UML Class Diagram](docs/UML_CLASS_DIAGRAM.md)
