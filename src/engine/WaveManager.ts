import { DifficultyLevel, EnemyType } from '../types/game';
import { Queue } from '../dsa/linear';
import { KaryTree } from '../dsa/trees';

export interface SpawnTask {
  type: EnemyType;
  waveScale: number;
  delayAfterPrev: number;
}

export class WaveManager {
  readonly spawnQueue = new Queue<SpawnTask>();
  readonly difficultyTree = new KaryTree<string>(3);
  private spawnTimer = 0;

  constructor(difficulty: DifficultyLevel) {
    // K-ary tree tracks wave progression tiers
    this.difficultyTree.insertLevelOrder(`Mode:${difficulty}`);
    this.difficultyTree.insertLevelOrder('Tier1:Scouts');
    this.difficultyTree.insertLevelOrder('Tier2:Armored');
    this.difficultyTree.insertLevelOrder('Tier3:Boss');
  }

  private getDifficultyMult(difficulty: DifficultyLevel): number {
    switch (difficulty) {
      case 'recruit':
        return 0.85;
      case 'standard':
        return 1.15;
      case 'veteran':
        return 1.75;
      case 'nightmare':
        return 2.65; // True brutal nightmare scaling
      default:
        return 1.15;
    }
  }

  prepareWave(waveNumber: number, difficulty: DifficultyLevel): void {
    this.spawnQueue.clear();
    const diffMult = this.getDifficultyMult(difficulty);
    const waveScale = (1 + (waveNumber - 1) * 0.28) * diffMult;

    const isNightmare = difficulty === 'nightmare';
    const isVeteran = difficulty === 'veteran';
    const countMultiplier = isNightmare ? 1.6 : isVeteran ? 1.3 : 1.0;
    const baseCount = Math.round((7 + waveNumber * 3) * countMultiplier);

    for (let i = 0; i < baseCount; i++) {
      let type: EnemyType = 'normal';

      if (waveNumber >= 2 && i % 4 === 1) type = 'fast';
      if (waveNumber >= 3 && i % 5 === 2) type = 'heavy';
      if (waveNumber >= 3 && i % 6 === 3) type = 'witch';
      if (waveNumber >= 4 && i % 5 === 4) type = 'armored';
      if (waveNumber >= 4 && i % 7 === 0) type = 'flying';
      if (waveNumber >= 5 && (i === 4 || i === baseCount - 3)) type = 'dragon';

      let delay = type === 'fast' ? 0.45 : type === 'dragon' ? 1.2 : type === 'heavy' ? 0.95 : 0.65;
      if (isNightmare) delay *= 0.72;
      this.spawnQueue.enqueue({ type, waveScale, delayAfterPrev: delay });
    }

    if (waveNumber % 5 === 0) {
      if (isNightmare) {
        this.spawnQueue.enqueue({ type: 'witch', waveScale: waveScale * 1.2, delayAfterPrev: 1.0 });
        this.spawnQueue.enqueue({ type: 'dragon', waveScale: waveScale * 1.3, delayAfterPrev: 1.0 });
      }
      this.spawnQueue.enqueue({
        type: 'boss',
        waveScale: waveScale * (isNightmare ? 1.5 : 1.25),
        delayAfterPrev: 1.5,
      });
      if (isNightmare) {
        this.spawnQueue.enqueue({ type: 'dragon', waveScale: waveScale * 1.3, delayAfterPrev: 1.5 });
      }
    }
    this.spawnTimer = 0.2;
  }

  tick(dt: number): SpawnTask | null {
    if (this.spawnQueue.isEmpty()) return null;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const next = this.spawnQueue.dequeue();
      this.spawnTimer = this.spawnQueue.isEmpty() ? 0 : this.spawnQueue.front().delayAfterPrev;
      return next;
    }
    return null;
  }
}

