# System Architecture — Tower Clash

## 1. Three-Layer Hybrid Execution Architecture

```
+-------------------------------------------------------------------+
| React 19 + TypeScript Frontend (Vite + Tailwind CSS + Canvas 2D)  |
| - Interactive 60fps Tower Defense Game Engine (src/engine/)       |
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

## 2. DSA Mapping Inside the Game Engine (`src/engine/GameEngine.ts`)

| Game Subsystem | Primary DSA Used | File Location |
|---|---|---|
| Battlefield Grid & Terrain | 2D Array + `SparseMatrix` overlay | `src/engine/maps.ts`, `src/dsa/linkedLists.ts` |
| Enemy Route Navigation | Dijkstra Shortest Path (`PathFinder`) | `src/engine/PathFinder.ts` |
| Wave Spawning Pipeline | FIFO `Queue<SpawnTask>` | `src/engine/WaveManager.ts`, `src/dsa/linear.ts` |
| Active Enemies on Field | `DoublyLinkedList<Enemy>` (O(1) unlink) | `src/engine/GameEngine.ts`, `src/dsa/linkedLists.ts` |
| Tower Inventory | `DynamicArray<Tower>` | `src/engine/GameEngine.ts`, `src/dsa/linear.ts` |
| Fast ID Lookup | `HashTable<Tower>` & `HashTable<Enemy>` | `src/engine/GameEngine.ts`, `src/dsa/hashing.ts` |
| Undo Placement History | LIFO `Stack<UndoAction>` | `src/engine/GameEngine.ts`, `src/dsa/linear.ts` |
| Periodic Resource/Alert Loop | `CircularQueue<PeriodicEvent>` | `src/engine/GameEngine.ts`, `src/dsa/linear.ts` |
| Tower Range Spatial Pruning | `QuadTree<Enemy>` or `KDTree<Enemy>` | `src/engine/GameEngine.ts`, `src/dsa/advancedTrees.ts` |
| Min/Max Active Enemy HP | `SegmentTree` | `src/engine/GameEngine.ts`, `src/dsa/advancedTrees.ts` |
| Smart Target Ranking | `PriorityQueue<Enemy>` + 8 Manual Sorts | `src/engine/TargetingStrategy.ts`, `src/dsa/sorting.ts` |
| Tower/Enemy Armory Search | `Trie` autocomplete + `HashTable` | `src/pages/TowerCollection.tsx`, `src/dsa/strings.ts` |
| Match Log Filtering | `SuffixArray` pattern search + Merge Sort | `src/pages/GameHistory.tsx`, `src/dsa/strings.ts` |

