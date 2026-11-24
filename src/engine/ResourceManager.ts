import { HashTable } from '../dsa/hashing';
import { DifficultyLevel } from '../types/game';
import { DIFFICULTY_PRESETS } from './balance';

export class ResourceManager {
  private readonly statsTable = new HashTable<number>('chaining', 19);

  constructor(difficulty: DifficultyLevel) {
    const preset = DIFFICULTY_PRESETS[difficulty] ?? DIFFICULTY_PRESETS.standard;

    this.statsTable.insert('gold', preset.startingGold);
    this.statsTable.insert('goldEarned', 0);
    this.statsTable.insert('baseHealth', preset.startHealth);
    this.statsTable.insert('maxBaseHealth', preset.startHealth);
    this.statsTable.insert('enemiesDefeated', 0);
    this.statsTable.insert('towersBuilt', 0);
  }

  get gold(): number {
    return this.statsTable.get('gold') ?? 0;
  }

  get goldEarned(): number {
    return this.statsTable.get('goldEarned') ?? 0;
  }

  get baseHealth(): number {
    return this.statsTable.get('baseHealth') ?? 0;
  }

  get maxBaseHealth(): number {
    return this.statsTable.get('maxBaseHealth') ?? 100;
  }

  get enemiesDefeated(): number {
    return this.statsTable.get('enemiesDefeated') ?? 0;
  }

  get towersBuilt(): number {
    return this.statsTable.get('towersBuilt') ?? 0;
  }

  canAfford(amount: number): boolean {
    return this.gold >= amount;
  }

  spendGold(amount: number): boolean {
    if (!this.canAfford(amount)) return false;
    this.statsTable.insert('gold', this.gold - amount);
    return true;
  }

  addGold(amount: number, countAsEarned = true): void {
    this.statsTable.insert('gold', this.gold + amount);
    if (countAsEarned) {
      this.statsTable.insert('goldEarned', this.goldEarned + amount);
    }
  }

  recordKill(reward: number): void {
    if (reward > 0) {
      this.addGold(reward, true);
    }
    this.statsTable.insert('enemiesDefeated', this.enemiesDefeated + 1);
  }

  recordTowerBuilt(): void {
    this.statsTable.insert('towersBuilt', this.towersBuilt + 1);
  }

  damageBase(amount: number): number {
    const next = Math.max(0, this.baseHealth - amount);
    this.statsTable.insert('baseHealth', next);
    return next;
  }

  inspectHashTelemetry(): { lookups: number; collisions: number } {
    const state = this.statsTable.inspectState();
    return { lookups: state.lookups, collisions: state.collisions };
  }
}
