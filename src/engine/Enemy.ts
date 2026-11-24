import { EnemySnapshot, EnemyType, GridCoord, Point2D, TerrainType } from '../types/game';

export abstract class Enemy {
  readonly id: number;
  readonly type: EnemyType;
  readonly name: string;
  protected health: number;
  readonly maxHealth: number;
  readonly baseSpeed: number;
  readonly armor: number;
  readonly reward: number;
  readonly isFlying: boolean;
  protected x: number;
  protected y: number;
  protected pathIndex = 0;
  protected readonly path: Point2D[];
  protected readonly gridPath: GridCoord[];
  protected slowTimer = 0;
  protected slowFactor = 1;
  protected burnTimer = 0;
  protected burnDps = 0;
  protected shieldActive = false;
  protected abilityCooldown = 0;
  protected hitFlashTimer = 0;
  protected alive = true;
  protected reachedBase = false;

  constructor(
    id: number,
    type: EnemyType,
    name: string,
    maxHealth: number,
    speed: number,
    armor: number,
    reward: number,
    isFlying: boolean,
    gridPath: GridCoord[],
    cellSize: number
  ) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
    this.baseSpeed = speed;
    this.armor = armor;
    this.reward = reward;
    this.isFlying = isFlying;
    this.gridPath = gridPath;
    this.path = gridPath.map((c) => ({
      x: c.col * cellSize + cellSize / 2,
      y: c.row * cellSize + cellSize / 2,
    }));
    this.x = this.path[0]?.x ?? 0;
    this.y = this.path[0]?.y ?? 0;
  }

  abstract updateAbility(dt: number): void;

  get currentSpeed(): number {
    const slowMult = this.slowTimer > 0 ? this.slowFactor : 1;
    return this.baseSpeed * slowMult;
  }

  get pathProgress(): number {
    if (this.path.length <= 1) return 1;
    const baseIdx = Math.min(this.pathIndex, this.path.length - 1);
    return baseIdx / (this.path.length - 1);
  }

  get threatScore(): number {
    const progressBonus = this.pathProgress * 120;
    const hpFactor = this.health * 0.25;
    const bossBonus = this.type === 'boss' ? 150 : 0;
    return Math.round(progressBonus + hpFactor + this.currentSpeed * 0.4 + bossBonus);
  }

  get isAlive(): boolean {
    return this.alive;
  }

  get hasReachedBase(): boolean {
    return this.reachedBase;
  }

  get position(): Point2D {
    return { x: this.x, y: this.y };
  }

  get currentHealth(): number {
    return this.health;
  }

  applySlow(factor: number, duration: number): void {
    this.slowFactor = Math.min(this.slowFactor, factor);
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  applyBurn(dps: number, duration: number): void {
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnTimer = Math.max(this.burnTimer, duration);
  }

  takeDamage(rawDamage: number, armorPiercing = false): number {
    if (!this.alive) return 0;
    const effectiveArmor = armorPiercing ? this.armor * 0.2 : this.armor;
    const shieldMult = this.shieldActive ? 0.55 : 1.0;
    const dmg = Math.max(1, (rawDamage - effectiveArmor) * shieldMult);
    this.health -= dmg;
    this.hitFlashTimer = 0.11;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
    return dmg;
  }

  update(dt: number, grid: TerrainType[][], cellSize: number): void {
    if (!this.alive || this.reachedBase) return;

    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowFactor = 1;
    }

    if (this.burnTimer > 0) {
      this.burnTimer -= dt;
      this.health -= this.burnDps * dt;
      if (this.health <= 0) {
        this.health = 0;
        this.alive = false;
        return;
      }
    }

    this.updateAbility(dt);

    // Check terrain slow zone for ground enemies
    let terrainMult = 1;
    if (!this.isFlying) {
      const r = Math.min(grid.length - 1, Math.max(0, Math.floor(this.y / cellSize)));
      const c = Math.min(grid[0].length - 1, Math.max(0, Math.floor(this.x / cellSize)));
      if (grid[r][c] === 'slow_zone') terrainMult = 0.65;
    }

    let moveLeft = this.currentSpeed * terrainMult * dt;
    while (moveLeft > 0 && this.pathIndex < this.path.length - 1) {
      const target = this.path[this.pathIndex + 1];
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= moveLeft) {
        this.x = target.x;
        this.y = target.y;
        moveLeft -= dist;
        this.pathIndex++;
      } else {
        this.x += (dx / dist) * moveLeft;
        this.y += (dy / dist) * moveLeft;
        moveLeft = 0;
      }
    }

    if (this.pathIndex >= this.path.length - 1) {
      this.reachedBase = true;
    }
  }

  toSnapshot(): EnemySnapshot {
    let status = 'Advancing';
    if (this.shieldActive) status = 'Shielded';
    else if (this.burnTimer > 0) status = 'Burning';
    else if (this.slowTimer > 0) status = 'Slowed';
    else if (this.isFlying) status = 'Airborne';

    return {
      id: this.id,
      type: this.type,
      name: this.name,
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      speed: Math.round(this.currentSpeed),
      baseSpeed: this.baseSpeed,
      armor: this.armor,
      x: this.x,
      y: this.y,
      pathIndex: this.pathIndex,
      pathProgress: this.pathProgress,
      reward: this.reward,
      status,
      threatScore: this.threatScore,
      isFlying: this.isFlying,
      slowTimer: this.slowTimer,
      shieldActive: this.shieldActive,
      hitFlash: this.hitFlashTimer > 0,
    };
  }
}

export class NormalEnemy extends Enemy {
  constructor(id: number, waveScale: number, path: GridCoord[], cellSize: number) {
    super(id, 'normal', 'Goblin Raider', Math.round(95 * waveScale), 72, 2, 14, false, path, cellSize);
  }
  updateAbility(): void {}
}

export class FastEnemy extends Enemy {
  constructor(id: number, waveScale: number, path: GridCoord[], cellSize: number) {
    super(id, 'fast', 'Shadow Wolf', Math.round(65 * waveScale), 132, 0, 14, false, path, cellSize);
  }
  updateAbility(): void {}
}

export class HeavyEnemy extends Enemy {
  constructor(id: number, waveScale: number, path: GridCoord[], cellSize: number) {
    super(id, 'heavy', 'Stone Golem', Math.round(270 * waveScale), 44, 8, 30, false, path, cellSize);
  }
  updateAbility(): void {}
}

export class ArmoredEnemy extends Enemy {
  constructor(id: number, waveScale: number, path: GridCoord[], cellSize: number) {
    super(id, 'armored', 'Orc Vanguard', Math.round(185 * waveScale), 56, 18, 28, false, path, cellSize);
  }
  updateAbility(): void {}
}

export class DragonEnemy extends Enemy {
  constructor(id: number, waveScale: number, airPath: GridCoord[], cellSize: number) {
    super(id, 'dragon', 'Ancient Wyvern', Math.round(540 * waveScale), 112, 10, 65, true, airPath, cellSize);
  }
  updateAbility(dt: number): void {
    if (this.slowTimer > 0) this.slowTimer -= dt * 2.0;
  }
}

export class WitchEnemy extends Enemy {
  constructor(id: number, waveScale: number, path: GridCoord[], cellSize: number) {
    super(id, 'witch', 'Shadow Witch', Math.round(330 * waveScale), 64, 4, 45, false, path, cellSize);
  }
  updateAbility(dt: number): void {
    this.abilityCooldown += dt;
    this.shieldActive = (this.abilityCooldown % 6) < 2.5;
  }
}

export class BossEnemy extends Enemy {
  constructor(id: number, waveScale: number, path: GridCoord[], cellSize: number) {
    super(id, 'boss', 'Kernel Overlord', Math.round(890 * waveScale), 38, 14, 150, false, path, cellSize);
  }
  updateAbility(dt: number): void {
    this.abilityCooldown += dt;
    // Cycles between Shield Pulse (2.8s) and Regeneration (4.2s)
    const cycle = this.abilityCooldown % 7;
    this.shieldActive = cycle < 2.8;
    if (!this.shieldActive && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + 18 * dt);
    }
  }
}

export class FlyingEnemy extends Enemy {
  constructor(id: number, waveScale: number, airPath: GridCoord[], cellSize: number) {
    super(id, 'flying', 'Winged Gargoyle', Math.round(95 * waveScale), 98, 4, 20, true, airPath, cellSize);
  }
  updateAbility(): void {}
}

export function createEnemyByType(
  id: number,
  type: EnemyType,
  waveScale: number,
  groundPath: GridCoord[],
  airPath: GridCoord[],
  cellSize: number
): Enemy {
  switch (type) {
    case 'fast':
      return new FastEnemy(id, waveScale, groundPath, cellSize);
    case 'heavy':
      return new HeavyEnemy(id, waveScale, groundPath, cellSize);
    case 'armored':
      return new ArmoredEnemy(id, waveScale, groundPath, cellSize);
    case 'dragon':
      return new DragonEnemy(id, waveScale, airPath, cellSize);
    case 'witch':
      return new WitchEnemy(id, waveScale, groundPath, cellSize);
    case 'boss':
      return new BossEnemy(id, waveScale, groundPath, cellSize);
    case 'flying':
      return new FlyingEnemy(id, waveScale, airPath, cellSize);
    case 'normal':
    default:
      return new NormalEnemy(id, waveScale, groundPath, cellSize);
  }
}

