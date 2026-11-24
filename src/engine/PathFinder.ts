import { GameMapConfig, GridCoord } from '../types/game';
import { Graph } from '../dsa/graphs';

export class PathFinder {
  static buildTerrainGraph(map: GameMapConfig): {
    graph: Graph;
    coordToId: Map<string, number>;
    idToCoord: GridCoord[];
  } {
    const graph = new Graph(false, true);
    const coordToId = new Map<string, number>();
    const idToCoord: GridCoord[] = [];

    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const t = map.grid[r][c];
        if (t !== 'obstacle' && t !== 'resource') {
          const id = graph.addVertex(`(${r},${c})`, c, r);
          coordToId.set(`${r},${c}`, id);
          idToCoord.push({ row: r, col: c });
        }
      }
    }

    const dirs = [
      [0, 1],
      [1, 0],
    ];
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const u = coordToId.get(`${r},${c}`);
        if (u === undefined) continue;
        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          const v = coordToId.get(`${nr},${nc}`);
          if (v === undefined) continue;
          const tA = map.grid[r][c];
          const tB = map.grid[nr][nc];
          const wA = tA === 'slow_zone' ? 3 : tA === 'path' || tA === 'entry' || tA === 'base' ? 1 : 4;
          const wB = tB === 'slow_zone' ? 3 : tB === 'path' || tB === 'entry' || tB === 'base' ? 1 : 4;
          graph.addEdge(u, v, (wA + wB) / 2);
        }
      }
    }

    return { graph, coordToId, idToCoord };
  }

  static findShortestPath(map: GameMapConfig, start: GridCoord, goal: GridCoord): {
    path: GridCoord[];
    cost: number;
    reachable: boolean;
  } {
    const { graph, coordToId, idToCoord } = PathFinder.buildTerrainGraph(map);
    const sId = coordToId.get(`${start.row},${start.col}`);
    const gId = coordToId.get(`${goal.row},${goal.col}`);
    if (sId === undefined || gId === undefined) {
      return { path: [], cost: Infinity, reachable: false };
    }
    const res = graph.dijkstraTrace(sId);
    if (res.distances[gId] === Infinity) {
      return { path: [], cost: Infinity, reachable: false };
    }
    const path: GridCoord[] = [];
    let cur: number | null = gId;
    while (cur !== null) {
      path.push(idToCoord[cur]);
      cur = res.parent[cur];
    }
    path.reverse();
    return { path, cost: res.distances[gId], reachable: true };
  }
}

