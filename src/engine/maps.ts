import { GameMapConfig, GridCoord, TerrainType } from '../types/game';

function createEmptyGrid(rows: number, cols: number): TerrainType[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 'buildable' as TerrainType));
}

function carvePath(grid: TerrainType[][], waypoints: GridCoord[]): GridCoord[] {
  const fullPath: GridCoord[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    let r = a.row;
    let c = a.col;
    while (r !== b.row || c !== b.col) {
      if (fullPath.length === 0 || fullPath[fullPath.length - 1].row !== r || fullPath[fullPath.length - 1].col !== c) {
        fullPath.push({ row: r, col: c });
      }
      if (grid[r][c] === 'buildable') grid[r][c] = 'path';
      if (r < b.row) r++;
      else if (r > b.row) r--;
      else if (c < b.col) c++;
      else if (c > b.col) c--;
    }
  }
  const last = waypoints[waypoints.length - 1];
  fullPath.push(last);
  const start = waypoints[0];
  grid[start.row][start.col] = 'entry';
  grid[last.row][last.col] = 'base';
  return fullPath;
}

// ---------------------------------------------------------------------------
// 1. Emerald Shire (Meadow Biome - Lush Grass & River Crossing)
// ---------------------------------------------------------------------------
function buildEmeraldShire(): GameMapConfig {
  const rows = 10;
  const cols = 16;
  const grid = createEmptyGrid(rows, cols);

  // Elegant S-shaped winding river valley path
  const groundPath = carvePath(grid, [
    { row: 1, col: 0 },
    { row: 1, col: 4 },
    { row: 4, col: 4 },
    { row: 4, col: 9 },
    { row: 8, col: 9 },
    { row: 8, col: 13 },
    { row: 4, col: 13 },
    { row: 4, col: 15 },
  ]);

  // River water obstacles, village cottages, windmills & dense forest groves
  const obstacles: GridCoord[] = [
    // Top meadow village & windmill grove
    { row: 0, col: 6 }, { row: 0, col: 7 }, { row: 1, col: 7 }, { row: 2, col: 7 },
    { row: 0, col: 11 }, { row: 1, col: 11 }, { row: 2, col: 11 }, { row: 3, col: 11 },
    // Center river crossing & cottages
    { row: 6, col: 1 }, { row: 6, col: 2 }, { row: 7, col: 2 }, { row: 8, col: 2 },
    { row: 6, col: 6 }, { row: 7, col: 6 }, { row: 8, col: 6 },
    // Right woodlands
    { row: 2, col: 14 }, { row: 6, col: 14 }, { row: 7, col: 14 },
    // South meadow farm
    { row: 9, col: 4 }, { row: 9, col: 5 }, { row: 9, col: 11 },
  ];
  for (const o of obstacles) grid[o.row][o.col] = 'obstacle';

  const slowZones: GridCoord[] = [
    { row: 4, col: 7 }, { row: 8, col: 11 },
  ];
  for (const s of slowZones) grid[s.row][s.col] = 'slow_zone';

  const resourceNodes: GridCoord[] = [
    { row: 2, col: 2 }, { row: 6, col: 11 }, { row: 8, col: 5 },
  ];
  for (const r of resourceNodes) grid[r.row][r.col] = 'resource';

  return {
    id: 'circuit-valley',
    name: 'Emerald Shire',
    subtitle: 'Realm 1 — River Meadow Crossing',
    description: 'Vibrant green rolling meadows, medieval windmills, and village cottages lead to the High King’s Citadel. Command your elven marksmen and sorceresses to guard the road!',
    rows,
    cols,
    cellSize: 52,
    difficultyRating: 'Balanced',
    biome: 'grass',
    grid,
    groundPath,
    airPath: [{ row: 1, col: 0 }, { row: 3, col: 8 }, { row: 4, col: 15 }],
    resourceNodes,
    wavesCount: 12,
  };
}

// ---------------------------------------------------------------------------
// 2. Sands of Kharid (Desert Biome - Golden Dunes & Ancient Pyramids)
// ---------------------------------------------------------------------------
function buildSandsOfKharid(): GameMapConfig {
  const rows = 10;
  const cols = 16;
  const grid = createEmptyGrid(rows, cols);

  // Twisting canyon road around ancient sandstone pyramids and desert oasis
  const groundPath = carvePath(grid, [
    { row: 8, col: 0 },
    { row: 8, col: 3 },
    { row: 2, col: 3 },
    { row: 2, col: 8 },
    { row: 7, col: 8 },
    { row: 7, col: 13 },
    { row: 2, col: 13 },
    { row: 2, col: 15 },
  ]);

  // Sandstone cliffs, ancient pyramid relics, Saguaro cactus groves & oasis
  const obstacles: GridCoord[] = [
    // Center-left pocket: Giant Saguaro Cacti, Sandstone Pyramids & Obelisks
    { row: 4, col: 5 }, { row: 5, col: 5 }, { row: 6, col: 5 },
    { row: 4, col: 6 }, { row: 5, col: 6 },
    // Center-right pocket: Palm Oasis, Prickly Pear Cacti & Ancient Relics
    { row: 3, col: 10 }, { row: 4, col: 10 }, { row: 5, col: 10 },
    { row: 4, col: 11 }, { row: 5, col: 11 },
    // Top dunes & ancient monument ridge
    { row: 0, col: 1 }, { row: 1, col: 1 },
    { row: 0, col: 5 }, { row: 0, col: 6 },
    { row: 0, col: 10 }, { row: 0, col: 11 },
    // Southern canyon bluffs & bone relics
    { row: 9, col: 5 }, { row: 9, col: 6 },
    { row: 8, col: 15 }, { row: 9, col: 15 },
    { row: 5, col: 0 }, { row: 6, col: 0 },
  ];
  for (const o of obstacles) grid[o.row][o.col] = 'obstacle';

  const slowZones: GridCoord[] = [
    { row: 2, col: 6 }, { row: 5, col: 8 }, { row: 7, col: 11 },
  ];
  for (const s of slowZones) grid[s.row][s.col] = 'slow_zone';

  const resourceNodes: GridCoord[] = [
    { row: 5, col: 1 }, { row: 0, col: 8 }, { row: 9, col: 10 },
  ];
  for (const r of resourceNodes) grid[r.row][r.col] = 'resource';

  return {
    id: 'bifurcation-nexus',
    name: 'Sands of Kharid',
    subtitle: 'Realm 2 — Whispering Dune Oasis',
    description: 'Scorching golden sands, towering Saguaro cacti, ancient pyramids, and lush palm oasis pools. Position sharp-eyed shadow rangers along the sandstone bluffs to crush the orc vanguard!',
    rows,
    cols,
    cellSize: 52,
    difficultyRating: 'Tactical',
    biome: 'desert',
    grid,
    groundPath,
    airPath: [{ row: 8, col: 0 }, { row: 4, col: 7 }, { row: 2, col: 15 }],
    resourceNodes,
    wavesCount: 14,
  };
}

// ---------------------------------------------------------------------------
// 3. Frostpeak Glacier (Snow Biome - Frozen Lake & Glacial Pass)
// ---------------------------------------------------------------------------
function buildFrostpeakGlacier(): GameMapConfig {
  const rows = 10;
  const cols = 16;
  const grid = createEmptyGrid(rows, cols);

  // Winding mountain switchback through deep snow and frozen rivers
  const groundPath = carvePath(grid, [
    { row: 0, col: 1 },
    { row: 4, col: 1 },
    { row: 4, col: 6 },
    { row: 1, col: 6 },
    { row: 1, col: 11 },
    { row: 8, col: 11 },
    { row: 8, col: 6 },
    { row: 6, col: 6 },
    { row: 6, col: 14 },
    { row: 4, col: 14 },
    { row: 4, col: 15 },
  ]);

  // Snowmen clusters, heavy snow pines, frost igloos & glowing crystal spires
  const obstacles: GridCoord[] = [
    // West glacier snowmen & pines
    { row: 2, col: 3 }, { row: 3, col: 3 }, { row: 2, col: 4 },
    // Center ice chasm & crystal cluster
    { row: 3, col: 8 }, { row: 4, col: 8 }, { row: 5, col: 8 },
    { row: 5, col: 9 }, { row: 6, col: 9 }, { row: 7, col: 9 },
    // North icy peak & igloo
    { row: 0, col: 8 }, { row: 0, col: 9 }, { row: 0, col: 13 },
    // South mountain ridge & frost boulders
    { row: 8, col: 2 }, { row: 9, col: 2 }, { row: 9, col: 3 },
    { row: 9, col: 8 }, { row: 9, col: 9 },
    { row: 2, col: 14 }, { row: 2, col: 15 },
  ];
  for (const o of obstacles) grid[o.row][o.col] = 'obstacle';

  const slowZones: GridCoord[] = [
    { row: 4, col: 4 }, { row: 1, col: 9 }, { row: 8, col: 8 },
  ];
  for (const s of slowZones) grid[s.row][s.col] = 'slow_zone';

  const resourceNodes: GridCoord[] = [
    { row: 7, col: 1 }, { row: 2, col: 8 }, { row: 1, col: 14 },
  ];
  for (const r of resourceNodes) grid[r.row][r.col] = 'resource';

  return {
    id: 'spiral-citadel',
    name: 'Frostpeak Glacier',
    subtitle: 'Realm 3 — High Glacial Pass',
    description: 'Crisp winter snowdrifts, festive 3D snowmen with top hats, snow-covered pines, and glowing frost crystals. Deploy Frost Templars and Dwarf Bombardiers to defend the Ice Fortress against Wyverns!',
    rows,
    cols,
    cellSize: 52,
    difficultyRating: 'Expert',
    biome: 'snow',
    grid,
    groundPath,
    airPath: [{ row: 0, col: 1 }, { row: 4, col: 8 }, { row: 4, col: 15 }],
    resourceNodes,
    wavesCount: 16,
  };
}

// ---------------------------------------------------------------------------
// 4. Molten Caldera (Volcano Biome - Magma Rivers & Obsidian Bastion)
// ---------------------------------------------------------------------------
function buildMoltenCaldera(): GameMapConfig {
  const rows = 10;
  const cols = 16;
  const grid = createEmptyGrid(rows, cols);

  // Intense zig-zag gauntlet through bubbling lava lakes to the Iron Citadel
  const groundPath = carvePath(grid, [
    { row: 5, col: 0 },
    { row: 5, col: 2 },
    { row: 1, col: 2 },
    { row: 1, col: 7 },
    { row: 8, col: 7 },
    { row: 8, col: 12 },
    { row: 3, col: 12 },
    { row: 3, col: 15 },
  ]);

  // Molten lava lakes, scorched basalt crags, and active steam vents
  const obstacles: GridCoord[] = [
    // Magma ridge left
    { row: 3, col: 4 }, { row: 4, col: 4 }, { row: 5, col: 4 }, { row: 6, col: 4 },
    { row: 3, col: 5 }, { row: 4, col: 5 },
    // Magma ridge right
    { row: 2, col: 9 }, { row: 3, col: 9 }, { row: 4, col: 9 }, { row: 5, col: 9 },
    { row: 3, col: 10 }, { row: 4, col: 10 },
    // Obsidian columns
    { row: 0, col: 4 }, { row: 0, col: 5 },
    { row: 0, col: 14 }, { row: 1, col: 14 },
    { row: 7, col: 14 }, { row: 8, col: 14 },
    { row: 9, col: 4 }, { row: 9, col: 5 },
  ];
  for (const o of obstacles) grid[o.row][o.col] = 'obstacle';

  const slowZones: GridCoord[] = [
    { row: 1, col: 5 }, { row: 6, col: 7 }, { row: 8, col: 10 }, { row: 5, col: 12 },
  ];
  for (const s of slowZones) grid[s.row][s.col] = 'slow_zone';

  const resourceNodes: GridCoord[] = [
    { row: 7, col: 1 }, { row: 0, col: 11 }, { row: 9, col: 9 },
  ];
  for (const r of resourceNodes) grid[r.row][r.col] = 'resource';

  return {
    id: 'dual-core-gauntlet',
    name: 'Molten Caldera',
    subtitle: 'Realm 4 — Volcanic Hellgate',
    description: 'Bubbling rivers of fiery magma and jagged obsidian spires. Survive 20 relentless waves of Shadow Witches, Ancient Fire Wyverns, and the colossal Kernel Overlord!',
    rows,
    cols,
    cellSize: 52,
    difficultyRating: 'Nightmare',
    biome: 'volcano',
    grid,
    groundPath,
    airPath: [{ row: 5, col: 0 }, { row: 4, col: 8 }, { row: 3, col: 15 }],
    resourceNodes,
    wavesCount: 20,
  };
}

export const GAME_MAPS: GameMapConfig[] = [
  buildEmeraldShire(),
  buildSandsOfKharid(),
  buildFrostpeakGlacier(),
  buildMoltenCaldera(),
];

export function getMapById(id: string): GameMapConfig {
  return GAME_MAPS.find((m) => m.id === id) ?? GAME_MAPS[0];
}
