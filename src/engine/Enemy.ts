import { DifficultyLevel, EnemySnapshot, EnemyType, GridCoord, Point2D, TerrainType } from '../types/game';
import {
  BASE_BOT_HP,
  BASE_BOT_SPEED,
  computeScaledBotHp,
  computeScaledBotReward,
  computeScaledBotSpeed,
  ENEMY_ARCHETYPES,
} from './balance';

export interface EnemySpawnConfig {
  waveNumber: number;
  difficulty: DifficultyLevel;
}

function resolveEnemyStats(
  type: EnemyType,
  scaleOrConfig: number | EnemySpawnConfig
): { maxHealth: number; speed: number; armor: number; reward: number; leakDamage: number } {
  const spec = ENEMY_ARCHETYPES[type] ?? ENEMY_ARCHETYPES.normal;
  if (typeof scaleOrConfig === 'number') {
    const waveScale = Math.max(0.1, scaleOrConfig);
    return {
      maxHealth: Math.max(1, Math.round(BASE_BOT_HP * spec.hpMult * waveScale)),
      speed: Math.round(BASE_BOT_SPEED * spec.speedMult),
      armor: spec.armor,
      reward: spec.reward,
      leakDamage: spec.leakDamage,
    };
  }
  return {
    maxHealth: computeScaledBotHp(scaleOrConfig.waveNumber, type, scaleOrConfig.difficulty),
    speed: computeScaledBotSpeed(type, scaleOrConfig.difficulty),
    armor: spec.armor,
    reward: computeScaledBotReward(type, scaleOrConfig.difficulty),
    leakDamage: spec.leakDamage,
  };
}

export abstract class Enemy {
  readonly id: number;
  readonly type: EnemyType;
  readonly name: string;
  protected health: number;
  readonly maxHealth: number;
  readonly baseSpeed: number;
  readonly armor: number;
  readonly reward: number;
  readonly leakDamage: number;
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
  private rewardClaimed = false;
  private baseDamageClaimed = false;

  constructor(
    id: number,
    type: EnemyType,
    name: string,
    maxHealth: number,
    speed: number,
    armor: number,
    reward: number,
    leakDamage: number,
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
    this.leakDamage = leakDamage;
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
    const bossBonus = this.type === 'boss' ? 150 : this.type === 'dragon' ? 75 : 0;
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

  /** Guarantees kill gold is awarded at most once even under simultaneous multi-hit frames. */
  claimReward(): number {
    if (this.alive || this.reachedBase || this.rewardClaimed) return 0;
    this.rewardClaimed = true;
    return this.reward;
  }

  /** Guarantees castle breach damage is applied at most once. */
  claimBaseBreach(): number {
    if (!this.reachedBase || !this.alive || this.baseDamageClaimed) return 0;
    this.baseDamageClaimed = true;
    this.alive = false;
    return this.leakDamage;
  }

  /** Takes the strongest active slow rather than compounding multiplicatively. */
  applySlow(factor: number, duration: number): void {
    const clampedFactor = Math.max(0.35, Math.min(1, factor));
    if (this.slowTimer <= 0) {
      this.slowFactor = clampedFactor;
    } else {
      this.slowFactor = Math.min(this.slowFactor, clampedFactor);
    }
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  applyBurn(dps: number, duration: number): void {
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnTimer = Math.max(this.burnTimer, duration);
  }

  takeDamage(rawDamage: number, armorPiercing = false): number {
    if (!this.alive || this.reachedBase) return 0;
    const effectiveArmor = armorPiercing ? this.armor * 0.2 : this.armor;
    const shieldMult = this.shieldActive ? 0.6 : 1.0;
    const dmg = Math.max(1, (rawDamage - effectiveArmor) * shieldMult);
    const applied = Math.min(this.health, dmg);
    this.health -= dmg;
    this.hitFlashTimer = 0.11;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
    return applied;
  }

  update(dt: number, grid: TerrainType[][], cellSize: number): void {
    if (!this.alive || this.reachedBase) return;

    if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);

    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.slowTimer = 0;
        this.slowFactor = 1;
      }
    }

    if (this.burnTimer > 0) {
      this.burnTimer -= dt;
      this.health -= this.burnDps * dt;
      if (this.burnTimer <= 0) {
        this.burnTimer = 0;
        this.burnDps = 0;
      }
      if (this.health <= 0) {
        this.health = 0;
        this.alive = false;
        return;
      }
    }

    this.updateAbility(dt);

    // Check terrain slow zone for ground enemies; cap combined slow at 0.35x so bots never stall
    let combinedSpeed = this.currentSpeed;
    if (!this.isFlying) {
      const r = Math.min(grid.length - 1, Math.max(0, Math.floor(this.y / cellSize)));
      const c = Math.min(grid[0].length - 1, Math.max(0, Math.floor(this.x / cellSize)));
      if (grid[r][c] === 'slow_zone') {
        const effectiveSlow = Math.max(0.35, (this.slowTimer > 0 ? this.slowFactor : 1) * 0.72);
        combinedSpeed = this.baseSpeed * effectiveSlow;
      }
    }

    let moveLeft = combinedSpeed * dt;
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

export class SwarmEnemy extends Enemy {
  constructor(id: number, waveScaleOrCfg: number | EnemySpawnConfig, path: GridCoord[], cellSize: number) {
    const s = resolveEnemyStats('swarm', waveScaleOrCfg);
    super(id, 'swarm', ENEMY_ARCHETYPES.swarm.name, s.maxHealth, s.speed, s.armor, s.reward, s.leakDamage, false, path, cellSize);
  }
  updateAbility(): void {}
}

export class NormalEnemy extends Enemy {
  constructor(id: number, waveScaleOrCfg: number | EnemySpawnConfig, path: GridCoord[], cellSize: number) {
    const s = resolveEnemyStats('normal', waveScaleOrCfg);
    super(id, 'normal', ENEMY_ARCHETYPES.normal.name, s.maxHealth, s.speed, s.armor, s.reward, s.leakDamage, false, path, cellSize);
  }
  updateAbility(): void {}
}

export class FastEnemy extends Enemy {
  constructor(id: number, waveScaleOrCfg: number | EnemySpawnConfig, path: GridCoord[], cellSize: number) {
    const s = resolveEnemyStats('fast', waveScaleOrCfg);
    super(id, 'fast', ENEMY_ARCHETYPES.fast.name, s.maxHealth, s.speed, s.armor, s.reward, s.leakDamage, false, path, cellSize);
  }
  updateAbility(): void {}
}

export class HeavyEnemy extends Enemy {
  constructor(id: number, waveScaleOrCfg: number | EnemySpawnConfig, path: GridCoord[], cellSize: number) {
    const s = resolveEnemyStats('heavy', waveScaleOrCfg);
    super(id, 'heavy', ENEMY_ARCHETYPES.heavy.name, s.maxHealth, s.speed, s.armor, s.reward, s.leakDamage, false, path, cellSize);
  }
  updateAbility(): void {}
}

export class ArmoredEnemy extends Enemy {
  constructor(id: number, waveScaleOrCfg: number | EnemySpawnConfig, path: GridCoord[], cellSize: number) {
    const s = resolveEnemyStats('armored', waveScaleOrCfg);
    super(id, 'armored', ENEMY_ARCHETYPES.armored.name, s.maxHealth, s.speed, s.armor, s.reward, s.leakDamage, false, path, cellSize);
  }
  updateAbility(): void {}
}

export class DragonEnemy extends Enemy {
  constructor(id: number, waveScaleOrCfg: number | EnemySpawnConfig, airPath: GridCoord[], cellSize: number) {
    const s = resolveEnemyStats('dragon', waveScaleOrCfg);
    super(id, 'dragon', ENEMY_ARCHETYPES.dragon.name, s.maxHealth, s.speed, s.armor, s.reward, s.leakDamage, true, airPath, cellSize);
  }
  override applySlow(factor: number, duration: number): void {
    // Wyvern sheds 40% of slow intensity and 35% of duration cleanly
    const reducedFactor = 1 - (1 - factor) * 0.6;
    super.applySlow(reducedFactor, duration * 0.65);
  }
  updateAbility(): void {}
}

export class WitchEnemy extends Enemy {
  constructor(id: number, waveScaleOrCfg: number | EnemySpawnConfig, path: GridCoord[], cellSize: number) {
    const s = resolveEnemyStats('witch', waveScaleOrCfg);
    super(id, 'witch', ENEMY_ARCHETYPES.witch.name, s.maxHealth, s.speed, s.armor, s.reward, s.leakDamage, false, path, cellSize);
  }
  updateAbility(dt: number): void {
    this.abilityCooldown += dt;
    this.shieldActive = (this.abilityCooldown % 6.5) < 2.2;
  }
}

export class BossEnemy extends Enemy {
  constructor(id: number, waveScaleOrCfg: number | EnemySpawnConfig, path: GridCoord[], cellSize: number) {
    const s = resolveEnemyStats('boss', waveScaleOrCfg);
    super(id, 'boss', ENEMY_ARCHETYPES.boss.name, s.maxHealth, s.speed, s.armor, s.reward, s.leakDamage, false, path, cellSize);
  }
  updateAbility(dt: number): void {
    this.abilityCooldown += dt;
    const cycle = this.abilityCooldown % 7;
    this.shieldActive = cycle < 2.5;
    if (!this.shieldActive && this.health < this.maxHealth) {
      // Proportional 1.2% maxHP/sec regen during unshielded phase
      this.health = Math.min(this.maxHealth, this.health + this.maxHealth * 0.012 * dt);
    }
  }
}

export class FlyingEnemy extends Enemy {
  constructor(id: number, waveScaleOrCfg: number | EnemySpawnConfig, airPath: GridCoord[], cellSize: number) {
    const s = resolveEnemyStats('flying', waveScaleOrCfg);
    super(id, 'flying', ENEMY_ARCHETYPES.flying.name, s.maxHealth, s.speed, s.armor, s.reward, s.leakDamage, true, airPath, cellSize);
  }
  updateAbility(): void {}
}

export function createEnemyByType(
  id: number,
  type: EnemyType,
  waveScaleOrCfg: number | EnemySpawnConfig,
  groundPath: GridCoord[],
  airPath: GridCoord[],
  cellSize: number
): Enemy {
  switch (type) {
    case 'swarm':
      return new SwarmEnemy(id, waveScaleOrCfg, groundPath, cellSize);
    case 'fast':
      return new FastEnemy(id, waveScaleOrCfg, groundPath, cellSize);
    case 'heavy':
      return new HeavyEnemy(id, waveScaleOrCfg, groundPath, cellSize);
    case 'armored':
      return new ArmoredEnemy(id, waveScaleOrCfg, groundPath, cellSize);
    case 'dragon':
      return new DragonEnemy(id, waveScaleOrCfg, airPath, cellSize);
    case 'witch':
      return new WitchEnemy(id, waveScaleOrCfg, groundPath, cellSize);
    case 'boss':
      return new BossEnemy(id, waveScaleOrCfg, groundPath, cellSize);
    case 'flying':
      return new FlyingEnemy(id, waveScaleOrCfg, airPath, cellSize);
    case 'normal':
    default:
      return new NormalEnemy(id, waveScaleOrCfg, groundPath, cellSize);
  }
}
