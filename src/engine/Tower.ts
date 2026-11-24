import { TargetingStrategyType, TowerSnapshot, TowerType } from '../types/game';
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
    cost: 70,
    damage: 30,
    attackSpeed: 1.3,
    range: 150,
    specialAbility: 'Overcharge Volley: Every 5th shot deals 2x damage',
    color: '#22c55e',
    description: 'Master elven archer firing rapid piercing arrows with deadly overcharge bursts.',
  },
  sniper: {
    type: 'sniper',
    name: 'Shadow Ranger',
    cost: 120,
    damage: 120,
    attackSpeed: 0.45,
    range: 280,
    specialAbility: 'Armor Piercing: Ignores 80% enemy armor',
    color: '#06b6d4',
    description: 'Cloaked master sniper delivering extreme long-range kinetic headshots that pierce heavy armor.',
  },
  rapid: {
    type: 'rapid',
    name: 'Crossbow Gunslinger',
    cost: 95,
    damage: 14,
    attackSpeed: 4.4,
    range: 135,
    specialAbility: 'Storm Barrage: High-velocity twin bolts',
    color: '#eab308',
    description: 'Dual-wielding repeating crossbow hero releasing a relentless torrent of bolts.',
  },
  splash: {
    type: 'splash',
    name: 'Dwarf Bombardier',
    cost: 135,
    damage: 56,
    attackSpeed: 0.75,
    range: 170,
    specialAbility: 'Concussion Blast: 75px area-of-effect splash',
    color: '#ef4444',
    description: 'Stout dwarven demolitionist launching heavy explosive shells that devastate clustered hordes.',
  },
  slow: {
    type: 'slow',
    name: 'Frost Templar',
    cost: 90,
    damage: 18,
    attackSpeed: 1.15,
    range: 145,
    specialAbility: 'Glacial Shockwave: Slows movement by 45% for 2.6s',
    color: '#38bdf8',
    description: 'Armored ice knight driving a runic frost blade into the ground to freeze enemy footing.',
  },
  laser: {
    type: 'laser',
    name: 'Arcane Sorceress',
    cost: 155,
    damage: 48,
    attackSpeed: 2.8,
    range: 180,
    specialAbility: 'Prismatic Ray: Continuous beam + 20 DPS thermal burn',
    color: '#a855f7',
    description: 'High wizardess hovering in the air channeling a continuous beam of concentrated mystic fire.',
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
    const levelMult = 1 + (this.level - 1) * 0.45;
    const boostMult = this.resourceBoost ? 1.2 : 1.0;
    return Math.round(this.baseDamage * levelMult * boostMult);
  }

  get attackSpeed(): number {
    return Number((this.baseAttackSpeed * (1 + (this.level - 1) * 0.16)).toFixed(2));
  }

  get range(): number {
    return Math.round(this.baseRange * (1 + (this.level - 1) * 0.1));
  }

  get upgradeCost(): number {
    return this.level >= 4 ? 0 : Math.round(this.baseCost * (0.75 * this.level));
  }

  get sellValue(): number {
    return Math.round(this.totalInvested * 0.7);
  }

  get upgradeLevel(): number {
    return this.level;
  }

  canUpgrade(): boolean {
    return this.level < 4;
  }

  upgrade(): number {
    const cost = this.upgradeCost;
    if (this.level < 4) {
      this.level++;
      this.totalInvested += cost;
    }
    return cost;
  }

  tickCooldown(dt: number): void {
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
  }

  isReady(): boolean {
    return this.cooldown <= 0;
  }

  abstract executeAttack(target: Enemy): AttackEvent;

  protected resetCooldown(): void {
    this.cooldown = 1 / this.attackSpeed;
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
      attackCooldown: this.cooldown,
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
      splashRadius: 70 + (this.level - 1) * 10,
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
    return {
      towerId: this.id,
      target,
      color: this.color,
      damage: this.damage,
      splashRadius: 50,
      isLaser: false,
      armorPiercing: false,
      slowFactor: 0.55 - (this.level - 1) * 0.05,
      slowDuration: 2.5,
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
      damage: Math.round(this.damage / 2.2),
      splashRadius: 0,
      isLaser: true,
      armorPiercing: true,
      burnDps: 18 + (this.level - 1) * 8,
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

