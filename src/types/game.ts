export type PageRoute =
  | 'home'
  | 'play'
  | 'maps'
  | 'towers'
  | 'lab'
  | 'structures'
  | 'visualizer'
  | 'performance'
  | 'history'
  | 'settings';

export type DifficultyLevel = 'recruit' | 'standard' | 'veteran' | 'nightmare';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type EnemyType =
  | 'swarm'
  | 'normal'
  | 'fast'
  | 'heavy'
  | 'armored'
  | 'boss'
  | 'flying'
  | 'dragon'
  | 'witch';

export type TowerType = 'basic' | 'sniper' | 'rapid' | 'splash' | 'slow' | 'laser';

export type TargetingStrategyType =
  | 'nearest'
  | 'weakest'
  | 'strongest'
  | 'fastest'
  | 'highest_threat'
  | 'first_on_path'
  | 'last_on_path';

export type SortAlgorithmType =
  | 'bubble'
  | 'selection'
  | 'insertion'
  | 'merge'
  | 'quick'
  | 'radix'
  | 'bucket'
  | 'counting';

export type TerrainType = 'buildable' | 'path' | 'entry' | 'base' | 'obstacle' | 'resource' | 'slow_zone';

export interface GridCoord {
  row: number;
  col: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface GameMapConfig {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  rows: number;
  cols: number;
  cellSize: number;
  difficultyRating: string;
  grid: TerrainType[][];
  groundPath: GridCoord[];
  airPath: GridCoord[];
  resourceNodes: GridCoord[];
  wavesCount: number;
  biome?: 'grass' | 'desert' | 'snow' | 'volcano';
}

export interface EnemySnapshot {
  id: number;
  type: EnemyType;
  name: string;
  health: number;
  maxHealth: number;
  speed: number;
  baseSpeed: number;
  armor: number;
  x: number;
  y: number;
  pathIndex: number;
  pathProgress: number;
  reward: number;
  status: string;
  threatScore: number;
  isFlying: boolean;
  slowTimer: number;
  shieldActive: boolean;
  hitFlash?: boolean;
}

export interface TowerSnapshot {
  id: number;
  type: TowerType;
  name: string;
  row: number;
  col: number;
  x: number;
  y: number;
  damage: number;
  attackSpeed: number;
  range: number;
  level: number;
  cost: number;
  upgradeCost: number;
  sellValue: number;
  specialAbility: string;
  targetingStrategy: TargetingStrategyType;
  kills: number;
  damageDealt: number;
  resourceBoost: boolean;
  lastTargetId: number | null;
  attackCooldown: number;
  shotsFired: number;
}

export interface ProjectileSnapshot {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  targetId: number;
  color: string;
  splashRadius: number;
  isLaser: boolean;
}

export interface GameDSAStats {
  spawnQueueSize: number;
  activeEnemyListSize: number;
  undoStackSize: number;
  circularEventCount: number;
  hashTableLookups: number;
  hashTableCollisions: number;
  spatialCandidatesChecked: number;
  bruteForceChecksAvoided: number;
  segmentTreeMinHp: number;
  segmentTreeMaxHp: number;
  targetingComparisons: number;
  targetingSwaps: number;
  lastTargetHeapSize: number;
}

export interface GameStateSnapshot {
  status: 'idle' | 'playing' | 'paused' | 'victory' | 'defeat';
  mapId: string;
  mapName: string;
  difficulty: DifficultyLevel;
  wave: number;
  totalWaves: number;
  waveActive: boolean;
  gold: number;
  goldEarned: number;
  baseHealth: number;
  maxBaseHealth: number;
  enemiesDefeated: number;
  elapsedSec: number;
  speedMultiplier: 1 | 2 | 3;
  sortAlgorithm: SortAlgorithmType;
  spatialStructure: 'quadtree' | 'kdtree';
  enemies: EnemySnapshot[];
  towers: TowerSnapshot[];
  projectiles: ProjectileSnapshot[];
  selectedTowerId: number | null;
  dsaStats: GameDSAStats;
  eventLog: string[];
  autoWaveEnabled?: boolean;
  autoWaveCountdown?: number;
  meteorCooldown?: number;
  frostCooldown?: number;
  spellEffects?: Array<{ kind: 'meteor' | 'frost'; x: number; y: number; progress: number }>;
}

export interface BenchmarkMetricRow {
  algorithm: string;
  inputSize: number;
  durationMs: number;
  comparisons: number;
  swaps: number;
  recursiveCalls: number;
  operations: number;
  memoryBytes: number;
}

export interface BenchmarkResponse {
  engine: string;
  category: string;
  pattern: string;
  results: BenchmarkMetricRow[];
}
