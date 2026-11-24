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
      7,
      Math.round((6 + waveNumber * 1.9) * preset.countMult)
    );
    const isBossWave = waveNumber === 5 || waveNumber === 10 || waveNumber === totalWaves;

    for (let i = 0; i < baseCount; i++) {
      let type: EnemyType = 'normal';

      if (waveNumber === 1 && i === 6) type = 'fast';
      if (waveNumber >= 2 && i % 4 === 1) type = 'fast';
      if (waveNumber >= 3 && i % 6 === 2) type = 'armored';
      if (waveNumber >= 4 && i % 8 === 3) type = 'flying';
      if (waveNumber >= 5 && i % 7 === 4) type = 'heavy';
      if (waveNumber >= 5 && i % 8 === 5) type = 'witch';

      // Tight Swarmling pack bursts on wave 2+
      if (waveNumber >= 2 && i > 0 && i % 5 === 0) {
        const packSize = Math.min(4, 2 + Math.floor(waveNumber / 5));
        for (let p = 0; p < packSize; p++) {
          this.spawnQueue.enqueue({
            type: 'swarm',
            waveConfig,
            delayAfterPrev: p === 0 ? 0.6 : 0.28,
          });
        }
        continue;
      }

      let delay =
        type === 'fast'
          ? 0.58
          : type === 'heavy' || type === 'armored'
          ? 0.98
          : type === 'witch'
          ? 0.88
          : 0.78;
      if (difficulty === 'veteran') delay *= 0.92;
      else if (difficulty === 'nightmare') delay *= 0.85;

      this.spawnQueue.enqueue({ type, waveConfig, delayAfterPrev: delay });
    }

    // Mini-boss Ancient Wyvern on mid/late milestones
    if (waveNumber === 6 || waveNumber === totalWaves) {
      this.spawnQueue.enqueue({
        type: 'dragon',
        waveConfig,
        delayAfterPrev: 1.4,
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
