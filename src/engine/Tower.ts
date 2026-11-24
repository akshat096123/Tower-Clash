import { TargetingStrategyType, TowerSnapshot, TowerType } from '../types/game';
import {
  MAX_TOWER_LEVEL,
  TOWER_DAMAGE_MULTS,
  TOWER_RANGE_MULTS,
  TOWER_SELL_REFUND_RATE,
  TOWER_SPEED_MULTS,
  TOWER_UPGRADE_COST_MULTS,
} from './balance';
import { Enemy } from './Enemy';

export interface TowerCatalogEntry {
  type: TowerType;
  name: string;
  cost: number;
  damage: number;
  attackSpeed: number;
  range: number;
  specialAbility: string;
  color: string;
  description: string;
}

export const TOWER_CATALOG: Record<TowerType, TowerCatalogEntry> = {
  basic: {
    type: 'basic',
    name: 'Elven Marksman',
    cost: 75,
    damage: 28,
    attackSpeed: 1.25,
    range: 155,
    specialAbility: 'Overcharge Volley: Every 5th shot deals 2x damage',
    color: '#22c55e',
    description: 'Reliable archer firing crisp arrows with every 5th shot dealing 2x overcharge damage.',
  },
  rapid: {
    type: 'rapid',
    name: 'Crossbow Gunslinger',
    cost: 100,
    damage: 14,
    attackSpeed: 3.6,
    range: 138,
    specialAbility: 'Storm Barrage: Rapid-fire bolts shred unarmored scouts & swarms',
    color: '#eab308',
    description: 'Dual-wielding crossbow hero unleashing high-velocity bolts against fast unarmored foes.',
  },
  slow: {
    type: 'slow',
    name: 'Frost Templar',
    cost: 95,
    damage: 22,
    attackSpeed: 1.2,
    range: 145,
    specialAbility: 'Glacial Shockwave: 55px AoE slow (40%–55% for 2.6s)',
    color: '#38bdf8',
    description: 'Armored frost paladin driving runic shockwaves to slow packs and amplify team DPS.',
  },
  sniper: {
    type: 'sniper',
    name: 'Shadow Ranger',
    cost: 125,
    damage: 105,
    attackSpeed: 0.52,
    range: 290,
    specialAbility: 'Armor Piercing: Long-range shot ignoring 80% armor',
    color: '#06b6d4',
    description: 'Cloaked marksman delivering extreme-range piercing shots that punch through armored tanks.',
  },
  splash: {
    type: 'splash',
    name: 'Dwarf Bombardier',
    cost: 135,
    damage: 42,
    attackSpeed: 0.78,
    range: 165,
    specialAbility: 'Concussion Blast: 75px–101px AoE mortar explosion',
    color: '#ef4444',
    description: 'Heavy dwarven mortar dealing modest single-target damage but devastating clustered packs.',
  },
  laser: {
    type: 'laser',
    name: 'Arcane Sorceress',
    cost: 155,
    damage: 21,
    attackSpeed: 2.5,
    range: 180,
    specialAbility: 'Prismatic Ray: Armor-piercing beam + 20–44 DPS thermal burn',
    color: '#a855f7',
    description: 'High wizardess channeling a piercing arcane ray that melts armored tanks and bosses.',
  },
};

export interface AttackEvent {
  towerId: number;
  target: Enemy;
  color: string;
  damage: number;
  splashRadius: number;
  isLaser: boolean;
  armorPiercing: boolean;
  slowFactor?: number;
  slowDuration?: number;
  burnDps?: number;
}

export abstract class Tower {
  readonly id: number;
  readonly type: TowerType;
  readonly name: string;
  readonly row: number;
  readonly col: number;
  readonly x: number;
  readonly y: number;
  protected baseDamage: number;
  protected baseAttackSpeed: number;
  protected baseRange: number;
  protected level = 1;
  readonly baseCost: number;
  protected totalInvested: number;
  readonly specialAbility: string;
  readonly color: string;
  public targetingStrategy: TargetingStrategyType = 'first_on_path';
  public resourceBoost = false;
  protected cooldown = 0;
  public kills = 0;
  public damageDealt = 0;
  public shotsFired = 0;
  public lastTargetId: number | null = null;

  constructor(
    id: number,
    type: TowerType,
    row: number,
    col: number,
    cellSize: number,
    resourceBoost = false
  ) {
    const cfg = TOWER_CATALOG[type];
    this.id = id;
    this.type = type;
    this.name = cfg.name;
    this.row = row;
    this.col = col;
    this.x = col * cellSize + cellSize / 2;
    this.y = row * cellSize + cellSize / 2;
    this.baseDamage = cfg.damage;
    this.baseAttackSpeed = cfg.attackSpeed;
    this.baseRange = cfg.range;
    this.baseCost = cfg.cost;
    this.totalInvested = cfg.cost;
    this.specialAbility = cfg.specialAbility;
    this.color = cfg.color;
    this.resourceBoost = resourceBoost;
  }

  get damage(): number {
    const idx = Math.min(TOWER_DAMAGE_MULTS.length - 1, this.level - 1);
    const levelMult = TOWER_DAMAGE_MULTS[idx];
    const boostMult = this.resourceBoost ? 1.2 : 1.0;
    return Math.round(this.baseDamage * levelMult * boostMult);
  }

  get attackSpeed(): number {
    const idx = Math.min(TOWER_SPEED_MULTS.length - 1, this.level - 1);
    return Number((this.baseAttackSpeed * TOWER_SPEED_MULTS[idx]).toFixed(2));
  }

  get range(): number {
    const idx = Math.min(TOWER_RANGE_MULTS.length - 1, this.level - 1);
    return Math.round(this.baseRange * TOWER_RANGE_MULTS[idx]);
  }

  get upgradeCost(): number {
    if (this.level >= MAX_TOWER_LEVEL) return 0;
    const mult = TOWER_UPGRADE_COST_MULTS[this.level - 1] ?? 1.55;
    return Math.round(this.baseCost * mult);
  }

  get investedGold(): number {
    return this.totalInvested;
  }

  get sellValue(): number {
    return Math.round(this.totalInvested * TOWER_SELL_REFUND_RATE);
  }

  get upgradeLevel(): number {
    return this.level;
  }

  canUpgrade(): boolean {
    return this.level < MAX_TOWER_LEVEL;
  }

  upgrade(): number {
    const cost = this.upgradeCost;
    if (this.level < MAX_TOWER_LEVEL) {
      this.level++;
      this.totalInvested += cost;
    }
    return cost;
  }

  tickCooldown(dt: number): void {
    if (this.cooldown > 0) {
      this.cooldown -= dt;
    }
  }

  isReady(): boolean {
    return this.cooldown <= 0;
  }

  abstract executeAttack(target: Enemy): AttackEvent;

  protected resetCooldown(): void {
    const period = 1 / this.attackSpeed;
    // Carry sub-step negative overflow cleanly so 1x/2x/3x speeds match DPS
    this.cooldown = Math.max(0, this.cooldown + period);
    this.shotsFired++;
    this.lastTargetId = null;
  }

  toSnapshot(): TowerSnapshot {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      row: this.row,
      col: this.col,
      x: this.x,
      y: this.y,
      damage: this.damage,
      attackSpeed: this.attackSpeed,
      range: this.range,
      level: this.level,
      cost: this.baseCost,
      upgradeCost: this.upgradeCost,
      sellValue: this.sellValue,
      specialAbility: this.specialAbility,
      targetingStrategy: this.targetingStrategy,
      kills: this.kills,
      damageDealt: Math.round(this.damageDealt),
      resourceBoost: this.resourceBoost,
      lastTargetId: this.lastTargetId,
      attackCooldown: Math.max(0, this.cooldown),
      shotsFired: this.shotsFired,
    };
  }
}

export class BasicTower extends Tower {
  constructor(id: number, row: number, col: number, cellSize: number, boost: boolean) {
    super(id, 'basic', row, col, cellSize, boost);
  }
  executeAttack(target: Enemy): AttackEvent {
    this.resetCooldown();
    this.lastTargetId = target.id;
    const isOvercharge = this.shotsFired % 5 === 0;
    return {
      towerId: this.id,
      target,
      color: isOvercharge ? '#facc15' : this.color,
      damage: isOvercharge ? this.damage * 2 : this.damage,
      splashRadius: 0,
      isLaser: false,
      armorPiercing: false,
    };
  }
}

export class SniperTower extends Tower {
  constructor(id: number, row: number, col: number, cellSize: number, boost: boolean) {
    super(id, 'sniper', row, col, cellSize, boost);
    this.targetingStrategy = 'strongest';
  }
  executeAttack(target: Enemy): AttackEvent {
    this.resetCooldown();
    this.lastTargetId = target.id;
    return {
      towerId: this.id,
      target,
      color: this.color,
      damage: this.damage,
      splashRadius: 0,
      isLaser: false,
      armorPiercing: true,
    };
  }
}

export class RapidTower extends Tower {
  constructor(id: number, row: number, col: number, cellSize: number, boost: boolean) {
    super(id, 'rapid', row, col, cellSize, boost);
    this.targetingStrategy = 'fastest';
  }
  executeAttack(target: Enemy): AttackEvent {
    this.resetCooldown();
    this.lastTargetId = target.id;
    return {
      towerId: this.id,
      target,
      color: this.color,
      damage: this.damage,
      splashRadius: 0,
      isLaser: false,
      armorPiercing: false,
    };
  }
}

export class SplashTower extends Tower {
  constructor(id: number, row: number, col: number, cellSize: number, boost: boolean) {
    super(id, 'splash', row, col, cellSize, boost);
    this.targetingStrategy = 'highest_threat';
  }
  executeAttack(target: Enemy): AttackEvent {
    this.resetCooldown();
    this.lastTargetId = target.id;
    return {
      towerId: this.id,
      target,
      color: this.color,
      damage: this.damage,
      splashRadius: 75 + (this.level - 1) * 13,
      isLaser: false,
      armorPiercing: false,
    };
  }
}

export class SlowTower extends Tower {
  constructor(id: number, row: number, col: number, cellSize: number, boost: boolean) {
    super(id, 'slow', row, col, cellSize, boost);
    this.targetingStrategy = 'nearest';
  }
  executeAttack(target: Enemy): AttackEvent {
    this.resetCooldown();
    this.lastTargetId = target.id;
    const slowFactors = [0.6, 0.52, 0.45];
    return {
      towerId: this.id,
      target,
      color: this.color,
      damage: this.damage,
      splashRadius: 55 + (this.level - 1) * 8,
      isLaser: false,
      armorPiercing: false,
      slowFactor: slowFactors[Math.min(slowFactors.length - 1, this.level - 1)],
      slowDuration: 2.6,
    };
  }
}

export class LaserTower extends Tower {
  constructor(id: number, row: number, col: number, cellSize: number, boost: boolean) {
    super(id, 'laser', row, col, cellSize, boost);
    this.targetingStrategy = 'highest_threat';
  }
  executeAttack(target: Enemy): AttackEvent {
    this.resetCooldown();
    this.lastTargetId = target.id;
    return {
      towerId: this.id,
      target,
      color: this.color,
      damage: this.damage,
      splashRadius: 0,
      isLaser: true,
      armorPiercing: true,
      burnDps: 20 + (this.level - 1) * 12,
    };
  }
}

export function createTowerByType(
  id: number,
  type: TowerType,
  row: number,
  col: number,
  cellSize: number,
  boost: boolean
): Tower {
  switch (type) {
    case 'sniper':
      return new SniperTower(id, row, col, cellSize, boost);
    case 'rapid':
      return new RapidTower(id, row, col, cellSize, boost);
    case 'splash':
      return new SplashTower(id, row, col, cellSize, boost);
    case 'slow':
      return new SlowTower(id, row, col, cellSize, boost);
    case 'laser':
      return new LaserTower(id, row, col, cellSize, boost);
    case 'basic':
    default:
      return new BasicTower(id, row, col, cellSize, boost);
  }
}
