import {
  DifficultyLevel,
  GameMapConfig,
  GameStateSnapshot,
  ProjectileSnapshot,
  SortAlgorithmType,
  TargetingStrategyType,
  TowerType,
} from '../types/game';
import { CircularQueue, DynamicArray, Stack } from '../dsa/linear';
import { DoublyLinkedList } from '../dsa/linkedLists';
import { HashTable } from '../dsa/hashing';
import { KDTree, QuadTree, SegmentTree } from '../dsa/advancedTrees';
import { createEnemyByType, Enemy } from './Enemy';
import { getMapById } from './maps';
import { ResourceManager } from './ResourceManager';
import { getTargetingStrategy } from './TargetingStrategy';
import { AttackEvent, createTowerByType, Tower, TOWER_CATALOG } from './Tower';
import { WaveManager } from './WaveManager';
import { DIFFICULTY_PRESETS, ECONOMY_BALANCE, SPELL_BALANCE } from './balance';

interface UndoTowerAction {
  kind: 'place';
  towerId: number;
  cost: number;
}

interface ActiveProjectile {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  targetId: number;
  towerId: number;
  color: string;
  damage: number;
  splashRadius: number;
  isLaser: boolean;
  laserLife: number;
  armorPiercing: boolean;
  slowFactor?: number;
  slowDuration?: number;
  burnDps?: number;
}

interface CircularGameEvent {
  label: string;
  intervalSec: number;
}

export class GameEngine {
  readonly map: GameMapConfig;
  readonly difficulty: DifficultyLevel;
  readonly resources: ResourceManager;
  readonly waveManager: WaveManager;

  private readonly activeEnemies = new DoublyLinkedList<Enemy>();
  private readonly towers = new DynamicArray<Tower>(16);
  private readonly enemyTable = new HashTable<Enemy>('linear', 53);
  private readonly towerTable = new HashTable<Tower>('chaining', 31);
  private readonly undoStack = new Stack<UndoTowerAction>();
  private readonly eventRing = new CircularQueue<CircularGameEvent>(4);

  private projectiles: ActiveProjectile[] = [];
  private status: 'idle' | 'playing' | 'paused' | 'victory' | 'defeat' = 'idle';
  private wave = 0;
  private waveActive = false;
  private elapsedSec = 0;
  private periodicTimer = 0;
  private speedMultiplier: 1 | 2 | 3 = 1;
  private sortAlgorithm: SortAlgorithmType = 'quick';
  private spatialStructure: 'quadtree' | 'kdtree' = 'quadtree';
  private selectedTowerId: number | null = null;
  private nextEnemyId = 1;
  private nextTowerId = 1;
  private nextProjId = 1;
  private eventLog: string[] = [];

  // Auto-wave idle timer & Mage Spell cooldowns
  private autoWaveEnabled = true;
  private autoWaveCountdown = 6.0;
  private meteorCooldown = 0;
  private frostCooldown = 0;
  private spellEffects: Array<{ kind: 'meteor' | 'frost'; x: number; y: number; age: number; duration: number }> = [];

  // Live DSA telemetry
  private lastCandidatesChecked = 0;
  private lastBruteForceAvoided = 0;
  private lastMinHp = 0;
  private lastMaxHp = 0;
  private lastTargetingComparisons = 0;
  private lastTargetingSwaps = 0;
  private lastHeapSize = 0;
  public lastSpatialBoxes: Array<{ x: number; y: number; w: number; h: number }> = [];
  public lastKdLines: Array<{ x1: number; y1: number; x2: number; y2: number; axis: 'x' | 'y' }> = [];

  constructor(mapId = 'circuit-valley', difficulty: DifficultyLevel = 'standard', sortAlgo: SortAlgorithmType = 'quick') {
    this.map = getMapById(mapId);
    this.difficulty = difficulty;
    this.sortAlgorithm = sortAlgo;
    this.resources = new ResourceManager(difficulty);
    this.waveManager = new WaveManager(difficulty);

    this.eventRing.enqueue({
      label: `Resource Crystal Dividend (+${ECONOMY_BALANCE.crystalDividendGold}g)`,
      intervalSec: ECONOMY_BALANCE.crystalDividendIntervalSec,
    });
    this.eventRing.enqueue({ label: 'Spatial Index Telemetry Sync', intervalSec: 12 });
    this.eventRing.enqueue({ label: 'Segment Tree HP Audit', intervalSec: 12 });

    this.log(`Initialized ${this.map.name} (${difficulty.toUpperCase()})`);
  }

  private log(msg: string): void {
    const t = this.elapsedSec.toFixed(1);
    this.eventLog.unshift(`[${t}s] ${msg}`);
    if (this.eventLog.length > 25) this.eventLog.pop();
  }

  hasAdjacentResource(row: number, col: number): boolean {
    for (const r of this.map.resourceNodes) {
      if (Math.abs(r.row - row) <= 1 && Math.abs(r.col - col) <= 1) {
        return true;
      }
    }
    return false;
  }

  getTowerAt(row: number, col: number): Tower | null {
    for (let i = 0; i < this.towers.size; i++) {
      const t = this.towers.get(i);
      if (t.row === row && t.col === col) return t;
    }
    return null;
  }

  canPlaceTower(row: number, col: number): boolean {
    if (row < 0 || row >= this.map.rows || col < 0 || col >= this.map.cols) return false;
    if (this.map.grid[row][col] !== 'buildable') return false;
    return this.getTowerAt(row, col) === null;
  }

  placeTower(type: TowerType, row: number, col: number): { ok: boolean; error?: string; towerId?: number } {
    if (!this.canPlaceTower(row, col)) {
      return { ok: false, error: 'Cell is occupied or non-buildable terrain.' };
    }
    const cost = TOWER_CATALOG[type].cost;
    if (!this.resources.canAfford(cost)) {
      return { ok: false, error: `Insufficient coins (need ${cost} Coins).` };
    }
    this.resources.spendGold(cost);
    this.resources.recordTowerBuilt();

    const id = this.nextTowerId++;
    const boost = this.hasAdjacentResource(row, col);
    const tower = createTowerByType(id, type, row, col, this.map.cellSize, boost);
    this.towers.pushBack(tower);
    this.towerTable.insert(`T-${id}`, tower);
    this.undoStack.push({ kind: 'place', towerId: id, cost });
    this.selectedTowerId = id;
    this.log(`Built ${tower.name} #${id} at (${row},${col})${boost ? ' [Resource +20%]' : ''}`);
    return { ok: true, towerId: id };
  }

  undoLastPlacement(): boolean {
    while (!this.undoStack.isEmpty()) {
      const action = this.undoStack.pop();
      if (action.kind === 'place') {
        for (let i = 0; i < this.towers.size; i++) {
          const tower = this.towers.get(i);
          if (tower.id === action.towerId) {
            const refund = tower.investedGold;
            this.towers.removeAt(i);
            this.towerTable.remove(`T-${action.towerId}`);
            this.resources.addGold(refund, false);
            if (this.selectedTowerId === action.towerId) this.selectedTowerId = null;
            this.log(`Undo Stack popped: removed Tower #${action.towerId}, refunded ${refund} Coins`);
            return true;
          }
        }
      }
    }
    return false;
  }

  upgradeTower(towerId: number): boolean {
    const tower = this.towerTable.get(`T-${towerId}`);
    if (!tower || !tower.canUpgrade()) return false;
    const cost = tower.upgradeCost;
    if (!this.resources.spendGold(cost)) return false;
    tower.upgrade();
    this.log(`Upgraded ${tower.name} #${towerId} to Lv.${tower.upgradeLevel}`);
    return true;
  }

  sellTower(towerId: number): boolean {
    for (let i = 0; i < this.towers.size; i++) {
      const tower = this.towers.get(i);
      if (tower.id === towerId) {
        const refund = tower.sellValue;
        this.towers.removeAt(i);
        this.towerTable.remove(`T-${towerId}`);
        this.resources.addGold(refund, false);
        // Remove sold tower from undoStack so sell + undo cannot double-refund
        const preserved: UndoTowerAction[] = [];
        while (!this.undoStack.isEmpty()) {
          const item = this.undoStack.pop();
          if (item.towerId !== towerId) preserved.push(item);
        }
        for (let k = preserved.length - 1; k >= 0; k--) {
          this.undoStack.push(preserved[k]);
        }
        if (this.selectedTowerId === towerId) this.selectedTowerId = null;
        this.log(`Sold ${tower.name} #${towerId} for +${refund} Coins`);
        return true;
      }
    }
    return false;
  }

  setTowerStrategy(towerId: number, strategy: TargetingStrategyType): void {
    const tower = this.towerTable.get(`T-${towerId}`);
    if (tower) {
      tower.targetingStrategy = strategy;
      this.log(`Tower #${towerId} strategy -> ${strategy}`);
    }
  }

  selectTower(towerId: number | null): void {
    this.selectedTowerId = towerId;
  }

  setSpeed(speed: 1 | 2 | 3): void {
    this.speedMultiplier = speed;
  }

  setSortAlgorithm(algo: SortAlgorithmType): void {
    this.sortAlgorithm = algo;
    this.log(`Targeting sorter switched to ${algo.toUpperCase()} Sort`);
  }

  setSpatialStructure(structure: 'quadtree' | 'kdtree'): void {
    this.spatialStructure = structure;
    this.log(`Spatial index switched to ${structure === 'quadtree' ? 'QuadTree' : 'KD-Tree'}`);
  }

  setAutoWave(enabled: boolean): void {
    this.autoWaveEnabled = enabled;
    if (enabled && !this.waveActive && this.autoWaveCountdown <= 0) {
      this.autoWaveCountdown = 4.0;
    }
  }

  skipWaveCountdown(): boolean {
    if (this.waveActive || this.status === 'victory' || this.status === 'defeat') return false;
    if (this.wave >= this.map.wavesCount) return false;
    if (this.wave > 0) {
      this.resources.addGold(ECONOMY_BALANCE.earlyWaveBonusGold, true);
      this.log(`Early Wave Call! +${ECONOMY_BALANCE.earlyWaveBonusGold} Coins bonus`);
    }
    return this.startNextWave();
  }

  castMeteor(targetX?: number, targetY?: number): boolean {
    if (this.meteorCooldown > 0 || this.status === 'victory' || this.status === 'defeat') return false;
    const enemiesArr = this.activeEnemies.toArray();
    const mapW = this.map.cols * this.map.cellSize;
    const mapH = this.map.rows * this.map.cellSize;
    let cx = targetX ?? mapW * 0.5;
    let cy = targetY ?? mapH * 0.5;
    if (targetX === undefined && enemiesArr.length > 0) {
      cx = enemiesArr[0].position.x;
      cy = enemiesArr[0].position.y;
    }

    this.meteorCooldown = SPELL_BALANCE.meteorCooldownSec;
    this.spellEffects.push({ kind: 'meteor', x: cx, y: cy, age: 0, duration: 0.7 });
    const meteorDmg = SPELL_BALANCE.meteorBaseDamage + this.wave * SPELL_BALANCE.meteorWaveDamage;
    for (const e of enemiesArr) {
      if (!e.isAlive || e.hasReachedBase) continue;
      const pos = e.position;
      if (Math.hypot(pos.x - cx, pos.y - cy) <= SPELL_BALANCE.meteorRadius) {
        e.takeDamage(meteorDmg, true);
        e.applyBurn(SPELL_BALANCE.meteorBurnDps, SPELL_BALANCE.meteorBurnDuration);
        if (!e.isAlive) {
          this.handleEnemyDeath(e);
        }
      }
    }
    this.log('Cast Meteor Strike!');
    return true;
  }

  castFrostNova(): boolean {
    if (this.frostCooldown > 0 || this.status === 'victory' || this.status === 'defeat') return false;
    const enemiesArr = this.activeEnemies.toArray();
    const mapW = this.map.cols * this.map.cellSize;
    const mapH = this.map.rows * this.map.cellSize;
    this.frostCooldown = SPELL_BALANCE.frostCooldownSec;
    this.spellEffects.push({ kind: 'frost', x: mapW / 2, y: mapH / 2, age: 0, duration: 0.85 });
    const frostDmg = SPELL_BALANCE.frostBaseDamage + this.wave * SPELL_BALANCE.frostWaveDamage;
    for (const e of enemiesArr) {
      if (!e.isAlive || e.hasReachedBase) continue;
      e.applySlow(SPELL_BALANCE.frostSlowFactor, SPELL_BALANCE.frostSlowDuration);
      e.takeDamage(frostDmg, true);
      if (!e.isAlive) {
        this.handleEnemyDeath(e);
      }
    }
    this.log('Cast Frost Nova — all invaders chilled!');
    return true;
  }

  private handleEnemyDeath(enemy: Enemy, killerTower?: Tower): void {
    const reward = enemy.claimReward();
    if (reward > 0 || !enemy.isAlive) {
      if (reward > 0 && killerTower) killerTower.kills++;
      this.activeEnemies.removeByPredicate((x) => x.id === enemy.id);
      this.enemyTable.remove(`E-${enemy.id}`);
      if (reward > 0) {
        this.resources.recordKill(reward);
      }
    }
  }

  togglePause(): void {
    if (this.status === 'playing') this.status = 'paused';
    else if (this.status === 'paused') this.status = 'playing';
  }

  startNextWave(): boolean {
    if (this.status === 'victory' || this.status === 'defeat') return false;
    if (this.waveActive) return false;
    if (this.wave >= this.map.wavesCount) return false;

    this.wave++;
    this.waveActive = true;
    this.autoWaveCountdown = 0;
    this.status = 'playing';
    this.waveManager.prepareWave(this.wave, this.difficulty, this.map.wavesCount);
    this.log(`Wave ${this.wave}/${this.map.wavesCount} marched!`);
    return true;
  }

  update(rawDt: number): void {
    if (this.status === 'paused' || this.status === 'victory' || this.status === 'defeat') return;

    const clampedRawDt = Math.min(0.05, Math.max(0, rawDt));

    this.spellEffects = this.spellEffects.filter((fx) => {
      fx.age += clampedRawDt;
      return fx.age < fx.duration;
    });

    // Auto-wave countdown before wave 1 or between waves
    if (!this.waveActive && this.wave < this.map.wavesCount) {
      if (this.autoWaveEnabled) {
        this.autoWaveCountdown -= clampedRawDt;
        if (this.autoWaveCountdown <= 0) {
          this.startNextWave();
        }
      }
      if (this.status === 'idle') return;
    }

    if (this.status !== 'playing') return;

    // Sub-step simulation in <= 0.025s ticks so 1x, 2x, and 3x speeds are mathematically identical
    const totalSimDt = clampedRawDt * this.speedMultiplier;
    const steps = Math.max(1, Math.ceil(totalSimDt / 0.025));
    const stepDt = totalSimDt / steps;

    for (let s = 0; s < steps; s++) {
      if (this.status !== 'playing') break;
      this.stepSimulation(stepDt);
    }
  }

  private stepSimulation(dt: number): void {
    if (this.meteorCooldown > 0) this.meteorCooldown = Math.max(0, this.meteorCooldown - dt);
    if (this.frostCooldown > 0) this.frostCooldown = Math.max(0, this.frostCooldown - dt);
    this.elapsedSec += dt;

    // 1. CircularQueue periodic game events
    this.periodicTimer += dt;
    if (this.periodicTimer >= ECONOMY_BALANCE.crystalDividendIntervalSec) {
      this.periodicTimer = 0;
      if (!this.eventRing.isEmpty()) {
        const ev = this.eventRing.dequeue();
        if (ev.label.includes('Resource Crystal')) {
          this.resources.addGold(ECONOMY_BALANCE.crystalDividendGold, true);
        }
        this.log(`CircularQueue Event: ${ev.label}`);
        this.eventRing.enqueue(ev);
      }
    }

    // 2. Spawn enemies from FIFO Queue -> DoublyLinkedList + HashTable
    const task = this.waveManager.tick(dt);
    if (task) {
      const id = this.nextEnemyId++;
      const enemy = createEnemyByType(
        id,
        task.type,
        task.waveConfig,
        this.map.groundPath,
        this.map.airPath,
        this.map.cellSize
      );
      this.activeEnemies.pushBack(enemy);
      this.enemyTable.insert(`E-${id}`, enemy);
    }

    // 3. Move active enemies & handle base breaches / burn deaths (at most once per bot)
    this.activeEnemies.forEach((enemy, node) => {
      enemy.update(dt, this.map.grid, this.map.cellSize);
      if (!enemy.isAlive) {
        const reward = enemy.claimReward();
        this.activeEnemies.removeNode(node);
        this.enemyTable.remove(`E-${enemy.id}`);
        if (reward > 0) {
          this.resources.recordKill(reward);
        }
      } else if (enemy.hasReachedBase) {
        const leakDmg = enemy.claimBaseBreach();
        this.activeEnemies.removeNode(node);
        this.enemyTable.remove(`E-${enemy.id}`);
        if (leakDmg > 0) {
          const hpLeft = this.resources.damageBase(leakDmg);
          this.log(`Base breached by ${enemy.name} (-${leakDmg} HP)`);
          if (hpLeft <= 0) {
            this.status = 'defeat';
            this.waveActive = false;
          }
        }
      }
    });

    if (this.resources.baseHealth <= 0) return;

    // 4. Build Spatial Index (QuadTree or KDTree) + SegmentTree over active enemies
    const enemiesArr = this.activeEnemies.toArray();
    const mapW = this.map.cols * this.map.cellSize;
    const mapH = this.map.rows * this.map.cellSize;

    const qt = new QuadTree<Enemy>({ x: 0, y: 0, w: mapW, h: mapH }, 3);
    const kd = new KDTree<Enemy>();

    for (const e of enemiesArr) {
      const pos = e.position;
      const entity = { id: e.id, x: pos.x, y: pos.y, data: e };
      if (this.spatialStructure === 'quadtree') qt.insert(entity);
      else kd.insert(entity);
    }

    if (this.spatialStructure === 'quadtree') {
      this.lastSpatialBoxes = qt.collectBoxes();
      this.lastKdLines = [];
    } else {
      this.lastKdLines = kd.collectSplitLines({ x: 0, y: 0, w: mapW, h: mapH });
      this.lastSpatialBoxes = [];
    }

    if (enemiesArr.length > 0) {
      const hpArr = enemiesArr.map((e) => Math.round(e.currentHealth));
      const seg = new SegmentTree(hpArr);
      this.lastMinHp = seg.queryMin(0, hpArr.length - 1);
      this.lastMaxHp = seg.queryMax(0, hpArr.length - 1);
    } else {
      this.lastMinHp = 0;
      this.lastMaxHp = 0;
    }

    // 5. Tower Targeting & Attacking
    let frameCandidates = 0;
    let frameAvoided = 0;
    let frameComp = 0;
    let frameSwaps = 0;
    let frameHeap = 0;

    for (let i = 0; i < this.towers.size; i++) {
      const tower = this.towers.get(i);
      tower.tickCooldown(dt);
      if (!tower.isReady() || enemiesArr.length === 0) continue;

      let candidates: Enemy[];
      if (this.spatialStructure === 'quadtree') {
        const res = qt.queryRadius(tower.x, tower.y, tower.range);
        candidates = res.map((r) => r.data);
        frameCandidates += qt.lastChecks;
        frameAvoided += Math.max(0, enemiesArr.length - qt.lastChecks);
      } else {
        const res = kd.queryRadius(tower.x, tower.y, tower.range);
        candidates = res.map((r) => r.data);
        frameCandidates += kd.lastNodesVisited;
        frameAvoided += Math.max(0, enemiesArr.length - kd.lastNodesVisited);
      }

      if (candidates.length === 0) continue;

      const strategy = getTargetingStrategy(tower.targetingStrategy);
      const outcome = strategy.selectTarget(tower, candidates, this.sortAlgorithm);
      frameComp += outcome.comparisons;
      frameSwaps += outcome.swaps;
      if (outcome.heapSize > frameHeap) frameHeap = outcome.heapSize;

      if (outcome.target) {
        const attack = tower.executeAttack(outcome.target);
        this.spawnProjectile(tower, attack);
      }
    }

    if (enemiesArr.length > 0 && this.towers.size > 0) {
      this.lastCandidatesChecked = frameCandidates;
      this.lastBruteForceAvoided = frameAvoided;
      if (frameComp > 0) {
        this.lastTargetingComparisons = frameComp;
        this.lastTargetingSwaps = frameSwaps;
        this.lastHeapSize = frameHeap;
      }
    }

    // 6. Update Projectiles & Apply Damage
    this.updateProjectiles(dt, enemiesArr);

    // 7. Wave completion, Anti-Softlock Guardrail & Victory check
    if (this.waveActive && this.waveManager.spawnQueue.isEmpty() && this.activeEnemies.size === 0) {
      this.waveActive = false;
      const preset = DIFFICULTY_PRESETS[this.difficulty] ?? DIFFICULTY_PRESETS.standard;
      const bonus = Math.round(
        (ECONOMY_BALANCE.waveClearBaseGold + this.wave * ECONOMY_BALANCE.waveClearPerWaveGold) *
          preset.rewardMult
      );
      this.resources.addGold(bonus, true);
      this.log(`Wave ${this.wave} cleared! +${bonus} Coins`);

      // Anti-softlock: if player has zero towers and below cheapest tower cost, grant emergency stipend
      if (this.towers.size === 0 && this.resources.gold < ECONOMY_BALANCE.cheapestTowerCost) {
        const deficit = ECONOMY_BALANCE.cheapestTowerCost - this.resources.gold;
        this.resources.addGold(deficit, true);
        this.log(`Emergency Garrison Stipend: +${deficit} Coins`);
      }

      if (this.wave >= this.map.wavesCount) {
        this.status = 'victory';
        this.log('All waves eliminated! Kingdom Defended!');
      } else if (this.autoWaveEnabled) {
        this.autoWaveCountdown = 4.0;
      }
    }
  }

  private spawnProjectile(tower: Tower, ev: AttackEvent): void {
    const targetPos = ev.target.position;
    if (ev.isLaser) {
      // Instant beam hit
      this.applyHit(tower, ev.target, ev);
      this.projectiles.push({
        id: this.nextProjId++,
        x: tower.x,
        y: tower.y,
        targetX: targetPos.x,
        targetY: targetPos.y,
        targetId: ev.target.id,
        towerId: tower.id,
        color: ev.color,
        damage: ev.damage,
        splashRadius: 0,
        isLaser: true,
        laserLife: 0.14,
        armorPiercing: ev.armorPiercing,
      });
      return;
    }

    this.projectiles.push({
      id: this.nextProjId++,
      x: tower.x,
      y: tower.y,
      targetX: targetPos.x,
      targetY: targetPos.y,
      targetId: ev.target.id,
      towerId: tower.id,
      color: ev.color,
      damage: ev.damage,
      splashRadius: ev.splashRadius,
      isLaser: false,
      laserLife: 0,
      armorPiercing: ev.armorPiercing,
      slowFactor: ev.slowFactor,
      slowDuration: ev.slowDuration,
      burnDps: ev.burnDps,
    });
  }

  private applyHit(tower: Tower | undefined, target: Enemy, ev: {
    damage: number;
    splashRadius: number;
    armorPiercing: boolean;
    slowFactor?: number;
    slowDuration?: number;
    burnDps?: number;
  }, enemiesArr?: Enemy[]): void {
    if (ev.splashRadius > 0 && enemiesArr) {
      const center = target.position;
      for (const e of enemiesArr) {
        if (!e.isAlive || e.hasReachedBase) continue;
        const p = e.position;
        if (Math.hypot(p.x - center.x, p.y - center.y) <= ev.splashRadius) {
          const dealt = e.takeDamage(ev.damage, ev.armorPiercing);
          if (tower) tower.damageDealt += dealt;
          if (ev.slowFactor && ev.slowDuration) e.applySlow(ev.slowFactor, ev.slowDuration);
          if (!e.isAlive) {
            this.handleEnemyDeath(e, tower);
          }
        }
      }
      return;
    }

    if (!target.isAlive || target.hasReachedBase) return;
    const dealt = target.takeDamage(ev.damage, ev.armorPiercing);
    if (tower) tower.damageDealt += dealt;
    if (ev.slowFactor && ev.slowDuration) target.applySlow(ev.slowFactor, ev.slowDuration);
    if (ev.burnDps) target.applyBurn(ev.burnDps, 2.0);
    if (!target.isAlive) {
      this.handleEnemyDeath(target, tower);
    }
  }

  private updateProjectiles(dt: number, enemiesArr: Enemy[]): void {
    const remaining: ActiveProjectile[] = [];
    const projSpeed = 480;
    for (const p of this.projectiles) {
      if (p.isLaser) {
        p.laserLife -= dt;
        if (p.laserLife > 0) remaining.push(p);
        continue;
      }

      const targetEnemy = this.enemyTable.get(`E-${p.targetId}`);
      if (targetEnemy && targetEnemy.isAlive) {
        const tp = targetEnemy.position;
        p.targetX = tp.x;
        p.targetY = tp.y;
      }

      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const dist = Math.hypot(dx, dy);
      const step = projSpeed * dt;

      if (dist <= step + 6) {
        const tower = this.towerTable.get(`T-${p.towerId}`);
        if (targetEnemy && targetEnemy.isAlive) {
          this.applyHit(tower, targetEnemy, p, enemiesArr);
        }
      } else {
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
        remaining.push(p);
      }
    }
    this.projectiles = remaining;
  }

  getSnapshot(): GameStateSnapshot {
    const hashRes = this.resources.inspectHashTelemetry();
    const enemyHash = this.enemyTable.inspectState();
    const towerHash = this.towerTable.inspectState();

    const towerSnaps = [];
    for (let i = 0; i < this.towers.size; i++) {
      towerSnaps.push(this.towers.get(i).toSnapshot());
    }

    const projSnaps: ProjectileSnapshot[] = this.projectiles.map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      targetX: p.targetX,
      targetY: p.targetY,
      targetId: p.targetId,
      color: p.color,
      splashRadius: p.splashRadius,
      isLaser: p.isLaser,
    }));

    return {
      status: this.status,
      mapId: this.map.id,
      mapName: this.map.name,
      difficulty: this.difficulty,
      wave: this.wave,
      totalWaves: this.map.wavesCount,
      waveActive: this.waveActive,
      gold: this.resources.gold,
      goldEarned: this.resources.goldEarned,
      baseHealth: this.resources.baseHealth,
      maxBaseHealth: this.resources.maxBaseHealth,
      enemiesDefeated: this.resources.enemiesDefeated,
      elapsedSec: Math.round(this.elapsedSec),
      speedMultiplier: this.speedMultiplier,
      sortAlgorithm: this.sortAlgorithm,
      spatialStructure: this.spatialStructure,
      enemies: this.activeEnemies.toArray().map((e) => e.toSnapshot()),
      towers: towerSnaps,
      projectiles: projSnaps,
      selectedTowerId: this.selectedTowerId,
      autoWaveEnabled: this.autoWaveEnabled,
      autoWaveCountdown: Number(Math.max(0, this.autoWaveCountdown).toFixed(1)),
      meteorCooldown: Number(this.meteorCooldown.toFixed(1)),
      frostCooldown: Number(this.frostCooldown.toFixed(1)),
      spellEffects: this.spellEffects.map((fx) => ({
        kind: fx.kind,
        x: fx.x,
        y: fx.y,
        progress: Math.min(1, fx.age / fx.duration),
      })),
      dsaStats: {
        spawnQueueSize: this.waveManager.spawnQueue.size,
        activeEnemyListSize: this.activeEnemies.size,
        undoStackSize: this.undoStack.size,
        circularEventCount: this.eventRing.size,
        hashTableLookups: hashRes.lookups + enemyHash.lookups + towerHash.lookups,
        hashTableCollisions: hashRes.collisions + enemyHash.collisions + towerHash.collisions,
        spatialCandidatesChecked: this.lastCandidatesChecked,
        bruteForceChecksAvoided: this.lastBruteForceAvoided,
        segmentTreeMinHp: this.lastMinHp,
        segmentTreeMaxHp: this.lastMaxHp,
        targetingComparisons: this.lastTargetingComparisons,
        targetingSwaps: this.lastTargetingSwaps,
        lastTargetHeapSize: this.lastHeapSize,
      },
      eventLog: [...this.eventLog],
    };
  }
}