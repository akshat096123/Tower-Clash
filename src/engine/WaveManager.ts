import { DifficultyLevel, EnemyType } from '../types/game';
import { Queue } from '../dsa/linear';
import { KaryTree } from '../dsa/trees';
import { DIFFICULTY_PRESETS } from './balance';
import { EnemySpawnConfig } from './Enemy';

export interface SpawnTask {
  type: EnemyType;
  waveConfig: EnemySpawnConfig;
  delayAfterPrev: number;
}

export class WaveManager {
  readonly spawnQueue = new Queue<SpawnTask>();
  readonly difficultyTree = new KaryTree<string>(3);
  private spawnTimer = 0;

  constructor(difficulty: DifficultyLevel) {
    this.difficultyTree.insertLevelOrder(`Mode:${difficulty}`);
    this.difficultyTree.insertLevelOrder('Tier1:Scouts');
    this.difficultyTree.insertLevelOrder('Tier2:Armored');
    this.difficultyTree.insertLevelOrder('Tier3:Boss');
  }

  prepareWave(waveNumber: number, difficulty: DifficultyLevel, totalWaves = 12): void {
    this.spawnQueue.clear();
    const preset = DIFFICULTY_PRESETS[difficulty] ?? DIFFICULTY_PRESETS.standard;
    const waveConfig: EnemySpawnConfig = { waveNumber, difficulty };

    const baseCount = Math.max(
      8,
      Math.round((7 + waveNumber * 2.0) * preset.countMult)
    );
    const isBossWave = waveNumber % 5 === 0 || waveNumber === totalWaves;

    for (let i = 0; i < baseCount; i++) {
      let type: EnemyType = 'normal';

      if (waveNumber === 1 && i >= 3 && i % 4 === 3) type = 'fast';
      if (waveNumber >= 2 && i % 4 === 1) type = 'fast';
      if (waveNumber === 2 && i === baseCount - 2) type = 'armored';
      if (waveNumber >= 3 && i % 6 === 2) type = 'armored';
      if (waveNumber === 3 && i === baseCount - 3) type = 'flying';
      if (waveNumber >= 4 && i % 7 === 3) type = 'heavy';
      if (waveNumber >= 4 && i % 8 === 4) type = 'witch';
      if (waveNumber >= 5 && i % 9 === 5) type = 'flying';

      // Tight Swarmling pack bursts on wave 2+
      if (waveNumber >= 2 && i > 0 && i % 5 === 0) {
        const packSize = Math.min(4, 2 + Math.floor(waveNumber / 4));
        for (let p = 0; p < packSize; p++) {
          this.spawnQueue.enqueue({
            type: 'swarm',
            waveConfig,
            delayAfterPrev: p === 0 ? 0.55 : 0.26,
          });
        }
        continue;
      }

      let delay =
        type === 'fast'
          ? 0.52
          : type === 'heavy' || type === 'armored'
          ? 0.92
          : type === 'witch'
          ? 0.82
          : 0.72;
      if (difficulty === 'veteran') delay *= 0.9;
      else if (difficulty === 'nightmare') delay *= 0.82;

      this.spawnQueue.enqueue({ type, waveConfig, delayAfterPrev: delay });
    }

    // Mini-boss Ancient Wyvern on mid/late milestones
    if (waveNumber >= 5 && (waveNumber % 5 === 0 || waveNumber >= totalWaves - 1)) {
      this.spawnQueue.enqueue({
        type: 'dragon',
        waveConfig,
        delayAfterPrev: 1.25,
      });
    }

    // Final Wave / Milestone Warlord Boss
    if (isBossWave) {
      this.spawnQueue.enqueue({
        type: 'boss',
        waveConfig,
        delayAfterPrev: 1.4,
      });
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
