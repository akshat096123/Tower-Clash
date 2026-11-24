import { SortAlgorithmType, TargetingStrategyType } from '../types/game';
import { manualSortWithComparator } from '../dsa/sorting';
import { PriorityQueue } from '../dsa/trees';
import { Enemy } from './Enemy';
import { Tower } from './Tower';

export interface TargetSelectionOutcome {
  target: Enemy | null;
  comparisons: number;
  swaps: number;
  heapSize: number;
}

export abstract class TargetingStrategy {
  abstract readonly type: TargetingStrategyType;
  abstract selectTarget(
    tower: Tower,
    candidates: Enemy[],
    sortAlgo: SortAlgorithmType
  ): TargetSelectionOutcome;
}

class ComparatorTargetingStrategy extends TargetingStrategy {
  readonly type: TargetingStrategyType;
  private readonly cmp: (tower: Tower, a: Enemy, b: Enemy) => number;
  private readonly keyFn: (tower: Tower, e: Enemy) => number;

  constructor(
    type: TargetingStrategyType,
    cmp: (tower: Tower, a: Enemy, b: Enemy) => number,
    keyFn: (tower: Tower, e: Enemy) => number
  ) {
    super();
    this.type = type;
    this.cmp = cmp;
    this.keyFn = keyFn;
  }

  selectTarget(tower: Tower, candidates: Enemy[], sortAlgo: SortAlgorithmType): TargetSelectionOutcome {
    if (candidates.length === 0) {
      return { target: null, comparisons: 0, swaps: 0, heapSize: 0 };
    }
    if (candidates.length === 1) {
      return { target: candidates[0], comparisons: 1, swaps: 0, heapSize: 0 };
    }
    const res = manualSortWithComparator(
      candidates,
      sortAlgo,
      (a, b) => this.cmp(tower, a, b),
      (e) => this.keyFn(tower, e)
    );
    return {
      target: res.sorted[0] ?? null,
      comparisons: res.comparisons,
      swaps: res.swaps,
      heapSize: 0,
    };
  }
}

class HighestThreatPriorityStrategy extends TargetingStrategy {
  readonly type: TargetingStrategyType = 'highest_threat';

  selectTarget(_tower: Tower, candidates: Enemy[]): TargetSelectionOutcome {
    if (candidates.length === 0) {
      return { target: null, comparisons: 0, swaps: 0, heapSize: 0 };
    }
    const pq = new PriorityQueue<Enemy>(true);
    for (const enemy of candidates) {
      pq.enqueue(enemy, enemy.threatScore);
    }
    const heapSize = pq.size;
    const top = pq.dequeue() ?? null;
    return {
      target: top,
      comparisons: Math.max(1, Math.ceil(Math.log2(heapSize + 1)) * heapSize),
      swaps: heapSize,
      heapSize,
    };
  }
}

const distSqToTower = (tower: Tower, e: Enemy) => {
  const pos = e.position;
  const dx = pos.x - tower.x;
  const dy = pos.y - tower.y;
  return dx * dx + dy * dy;
};

const STRATEGY_INSTANCES: Record<TargetingStrategyType, TargetingStrategy> = {
  nearest: new ComparatorTargetingStrategy(
    'nearest',
    (t, a, b) => distSqToTower(t, a) - distSqToTower(t, b),
    (t, e) => distSqToTower(t, e)
  ),
  weakest: new ComparatorTargetingStrategy(
    'weakest',
    (_t, a, b) => a.currentHealth - b.currentHealth,
    (_t, e) => e.currentHealth
  ),
  strongest: new ComparatorTargetingStrategy(
    'strongest',
    (_t, a, b) => b.currentHealth - a.currentHealth,
    (_t, e) => Math.max(0, 100000 - e.currentHealth)
  ),
  fastest: new ComparatorTargetingStrategy(
    'fastest',
    (_t, a, b) => b.currentSpeed - a.currentSpeed,
    (_t, e) => Math.max(0, 1000 - e.currentSpeed)
  ),
  highest_threat: new HighestThreatPriorityStrategy(),
  first_on_path: new ComparatorTargetingStrategy(
    'first_on_path',
    (_t, a, b) => b.pathProgress - a.pathProgress,
    (_t, e) => Math.max(0, Math.round((1 - e.pathProgress) * 1000))
  ),
  last_on_path: new ComparatorTargetingStrategy(
    'last_on_path',
    (_t, a, b) => a.pathProgress - b.pathProgress,
    (_t, e) => Math.round(e.pathProgress * 1000)
  ),
};

export function getTargetingStrategy(type: TargetingStrategyType): TargetingStrategy {
  return STRATEGY_INSTANCES[type] ?? STRATEGY_INSTANCES.first_on_path;
}

