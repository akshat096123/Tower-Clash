# Tower Clash: 3D Tower Defense Strategy Game

An interactive 2D Tower Defense Game powered directly by manual Data Structures and Algorithms, paired with a 10-module **DSA Algorithm Visualization Laboratory** and a **C++17 + TypeScript Measured Performance Analytics Dashboard**.

---

## Core Modules

1. **Module A — Playable 2D Tower Defense Game** (`src/engine/`, `src/pages/PlayGame.tsx`)
   - 4 battlefield maps (`Circuit Valley`, `Red-Black Fortress`, `Sparse Matrix Basin`, `Eulerian Citadel`) with Dijkstra-verified routes, resource crystals, slow zones, and obstacles.
   - 6 polymorphic Enemy classes (`NormalEnemy`, `FastEnemy`, `HeavyEnemy`, `ArmoredEnemy`, `BossEnemy`, `FlyingEnemy`) descending from abstract `Enemy`.
   - 6 polymorphic Tower classes (`BasicTower`, `SniperTower`, `RapidTower`, `SplashTower`, `SlowTower`, `LaserTower`) descending from abstract `Tower`.
   - 7 polymorphic `TargetingStrategy` policies (`nearest`, `weakest`, `strongest`, `fastest`, `highest_threat`, `first_on_path`, `last_on_path`) backed by `PriorityQueue` and selectable manual sorting algorithms (`Bubble`, `Selection`, `Insertion`, `Merge`, `Quick`, `Radix`, `Bucket`, `Counting`).
   - Live DSA Engine Telemetry HUD tracking Queue spawns, DoublyLinkedList active enemies, Stack undo actions, CircularQueue periodic events, HashTable O(1) lookups/collisions, QuadTree/KD-Tree spatial query pruning, and SegmentTree min/max enemy HP queries.

2. **Module B — DSA Algorithm Laboratory** (`src/pages/DsaLab.tsx`, `src/pages/lab/`)
   - 10 syllabus modules with custom inputs, step-by-step playback, comparison/swap counters, and battlefield engine mappings:
     1. **Linear DS**: `DynamicArray`, `Stack`, `Queue`, `CircularQueue`
     2. **Searching**: `Linear Search`, `Binary Search`, deterministic `Median-of-Medians Search`
     3. **Sorting (8)**: `Bubble`, `Selection`, `Insertion`, `Merge`, `Quick`, `Radix`, `Bucket`, `Counting` + Compare Mode
     4. **Hashing**: `Separate Chaining`, `Linear Probing`, `Quadratic Probing`, `Double Hashing`
     5. **Linked Lists & Sparse Matrix**: `SinglyLinkedList`, `DoublyLinkedList`, `CircularLinkedList`, `Multi-Linked Sparse Matrix` (row-wise/col-wise traversal + memory savings)
     6. **Trees & Heaps**: `BinaryTree`, `KaryTree`, `BST`, `ThreadedBinaryTree`, `AVLTree`, `RedBlackTree`, `BTree`, `BPlusTree`, `BinaryHeap`, `PriorityQueue`
     7. **Graphs**: `BFS`, `DFS`, `Dijkstra`, `Bellman-Ford`, `Floyd-Warshall`, `Prim MST`, `Kruskal MST` (+ interactive vertex/edge editor)
     8. **Backtracking**: `Rat in a Maze` & configurable `N-Queens`
     9. **Spatial & Advanced Trees**: `IntervalTree`, `SegmentTree`, `RangeTree2D`, `KDTree`, `QuadTree`
     10. **Strings**: `Trie`, `SuffixTree`, `SuffixArray`, `Polynomial Hash / Rabin-Karp`

3. **Module C — Performance Analysis Dashboard** (`src/pages/PerformanceAnalysis.tsx`, `cpp/`)
   - Invokes the compiled native C++17 DSA benchmark binary (`cpp/build/dsa_engine`) via Express (`GET /api/benchmarks/run`) or compares in-browser TypeScript timings across multiple input sizes (`100` to `10,000`) and distributions (`random`, `sorted`, `reversed`, `best`, `average`, `worst`).
   - Records real execution time (ms), comparisons, swaps/writes, recursive calls, total operations, and estimated bytes, persisting runs in SQLite (`data/dsa_defense.sqlite`).

---

## Prerequisites

- **Node.js** `v22+` (includes built-in `node:sqlite`; tested with `v26.7.0`)
- **clang++** or **g++** supporting C++17 (`make`)

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build the C++17 DSA engine & production frontend bundle
npm run build

# 3. Run all TypeScript (Vitest) and C++17 unit tests
npm run test

# 4. Start development mode (Express API on :3001 + Vite dev server on :5173)
npm run dev

# Or run unified production server (serves built dist/ + /api on :3001)
npm run start
```

---

## Project Structure

- `cpp/include/` — Manual C++17 template headers (`DynamicArray`, `Stack`, `Queue`, `CircularQueue`, linked lists, `SparseMatrix`, hash tables, 8 sorts, trees, graphs, backtracking, strings, `MemoryTracker`).
- `cpp/src/dsa_engine.cpp` — Native JSON CLI benchmark runner invoked safely via `execFile`.
- `cpp/tests/test_dsa.cpp` — C++17 unit tests with leak verification.
- `server/` — Express v5 API & `node:sqlite` persistence (`player_profile`, `game_history`, `benchmark_runs`, `settings`).
- `src/dsa/` — Manual TypeScript DSA modules with step-by-step visualization traces.
- `src/engine/` — Object-oriented Tower Defense engine (`GameEngine`, `GameMap`, `Enemy`, `Tower`, `TargetingStrategy`, `PathFinder`, `WaveManager`, `ResourceManager`).
- `src/pages/` — UI views for Home Dashboard, Play Game, Maps, Tower Collection, DSA Lab, Performance Analysis, History, and Settings.
- `src/tests/` — Vitest suites for DSA correctness and game engine mechanics.
- `docs/` — Architecture notes, UML Class Diagram, and Data-Flow Diagram.

