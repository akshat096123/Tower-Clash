import { describe, expect, it } from 'vitest';
import { GameEngine } from '../engine/GameEngine';
import { GAME_MAPS } from '../engine/maps';
import { PathFinder } from '../engine/PathFinder';
import { NormalEnemy } from '../engine/Enemy';
import { BasicTower, LaserTower } from '../engine/Tower';
import { getTargetingStrategy } from '../engine/TargetingStrategy';
import { BASE_BOT_HP, computeScaledBotHp, DIFFICULTY_PRESETS, WAVE_HP_EXPONENT } from '../engine/balance';
import { TowerType } from '../types/game';

describe('Tower Defense OOP Architecture & Gameplay Engine', () => {
  it('computes valid Dijkstra shortest paths on every battlefield map', () => {
    for (const m of GAME_MAPS) {
      const start = m.groundPath[0];
      const goal = m.groundPath[m.groundPath.length - 1];
      const res = PathFinder.findShortestPath(m, start, goal);
      expect(res.reachable).toBe(true);
      expect(res.path.length).toBeGreaterThan(5);
    }
  });

  it('places, upgrades, undoes via Stack, switches targeting, and sells towers', () => {
    const engine = new GameEngine('circuit-valley', 'standard', 'quick');
    const map = GAME_MAPS[0];

    // Find first buildable cell
    let buildCell: { row: number; col: number } | null = null;
    for (let r = 0; r < map.rows && !buildCell; r++) {
      for (let c = 0; c < map.cols && !buildCell; c++) {
        if (map.grid[r][c] === 'buildable') {
          buildCell = { row: r, col: c };
        }
      }
    }
    expect(buildCell).not.toBeNull();

    const initialGold = engine.getSnapshot().gold;
    const placeRes = engine.placeTower('basic', buildCell!.row, buildCell!.col);
    expect(placeRes.ok).toBe(true);
    let snap = engine.getSnapshot();
    expect(snap.towers.length).toBe(1);
    expect(snap.gold).toBeLessThan(initialGold);
    expect(snap.dsaStats.undoStackSize).toBe(1);

    const towerId = snap.towers[0].id;
    const upgradeRes = engine.upgradeTower(towerId);
    expect(upgradeRes).toBe(true);
    expect(engine.getSnapshot().towers[0].level).toBe(2);

    engine.setTowerStrategy(towerId, 'strongest');
    expect(engine.getSnapshot().towers[0].targetingStrategy).toBe('strongest');

    // Undo should remove the newly built tower and refund gold
    const undoRes = engine.undoLastPlacement();
    expect(undoRes).toBe(true);
    expect(engine.getSnapshot().towers.length).toBe(0);

    // Re-place and test sell
    engine.placeTower('sniper', buildCell!.row, buildCell!.col);
    const sniperId = engine.getSnapshot().towers[0].id;
    const sellRes = engine.sellTower(sniperId);
    expect(sellRes).toBe(true);
    expect(engine.getSnapshot().towers.length).toBe(0);
  });

  it('spawns waves, runs spatial queries + targeting sorts, and defeats enemies', () => {
    const engine = new GameEngine('circuit-valley', 'recruit', 'merge');
    const map = GAME_MAPS[0];

    // Place 3 buildable cells close to path
    const buildCells: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        if (map.grid[r][c] === 'buildable') buildCells.push({ row: r, col: c });
      }
    }

    const types: TowerType[] = ['basic', 'rapid', 'splash'];
    for (let i = 0; i < Math.min(3, buildCells.length); i++) {
      engine.placeTower(types[i], buildCells[i].row, buildCells[i].col);
    }

    engine.startNextWave();
    for (let step = 0; step < 300; step++) {
      engine.update(0.05);
    }

    const snap = engine.getSnapshot();
    expect(snap.wave).toBeGreaterThanOrEqual(1);
    expect(snap.dsaStats.activeEnemyListSize + snap.enemiesDefeated).toBeGreaterThan(0);

    // Test active Mage spells (Meteor & Frost Nova) & early wave skip
    expect(engine.castFrostNova()).toBe(true);
    expect(engine.castMeteor()).toBe(true);
    expect(engine.getSnapshot().meteorCooldown).toBeGreaterThan(0);
    expect(engine.getSnapshot().frostCooldown).toBeGreaterThan(0);
  });

  it('uses polymorphic TargetingStrategy with manual sorting algorithms', () => {
    const path = [
      { row: 0, col: 0 },
      { row: 0, col: 5 },
    ];
    const e1 = new NormalEnemy(1, 1, path, 48);
    const e2 = new NormalEnemy(2, 1, path, 48);
    e1.takeDamage(50, false); // weaker enemy (lower HP)

    const tower = new BasicTower(1, 1, 1, 48, false);
    const weakest = getTargetingStrategy('weakest');
    const out = weakest.selectTarget(tower, [e1, e2], 'counting');
    expect(out.target?.id).toBe(1);
    expect(out.comparisons + out.swaps).toBeGreaterThanOrEqual(0);
  });

  it('enforces exact wave HP scaling formula, clean slow stacking, and single-claim deaths', () => {
    const expectedW5Hard = Math.round(BASE_BOT_HP * 1.0 * Math.pow(WAVE_HP_EXPONENT, 4) * DIFFICULTY_PRESETS.veteran.hpMult);
    expect(computeScaledBotHp(5, 'normal', 'veteran')).toBe(expectedW5Hard);
    expect(computeScaledBotHp(1, 'normal', 'recruit')).toBe(Math.round(BASE_BOT_HP * 0.75));

    const path = [
      { row: 0, col: 0 },
      { row: 0, col: 6 },
    ];
    const bot = new NormalEnemy(1, { waveNumber: 1, difficulty: 'standard' }, path, 48);
    // Slow stacking takes strongest slow instead of multiplying 0.6 * 0.45
    bot.applySlow(0.6, 2.0);
    bot.applySlow(0.45, 3.0);
    expect(bot.currentSpeed).toBeCloseTo(bot.baseSpeed * 0.45, 5);

    // Enemy cannot die twice or award reward twice
    bot.takeDamage(5000, true);
    expect(bot.isAlive).toBe(false);
    expect(bot.claimReward()).toBe(14);
    expect(bot.claimReward()).toBe(0);
    expect(bot.takeDamage(100, true)).toBe(0);
  });

  it('prevents sell+undo gold exploits, honors Lv3 upgrade caps, and matches 1x/3x speed parity', () => {
    const engine = new GameEngine('circuit-valley', 'standard', 'quick');
    const map = GAME_MAPS[0];
    let cell: { row: number; col: number } | null = null;
    for (let r = 0; r < map.rows && !cell; r++) {
      for (let c = 0; c < map.cols && !cell; c++) {
        if (map.grid[r][c] === 'buildable') cell = { row: r, col: c };
      }
    }
    expect(cell).not.toBeNull();

    // Sell removes from undo stack so sell + undo cannot double-refund
    const startGold = engine.getSnapshot().gold;
    const p1 = engine.placeTower('basic', cell!.row, cell!.col);
    expect(p1.ok).toBe(true);
    engine.sellTower(p1.towerId!);
    expect(engine.undoLastPlacement()).toBe(false);
    expect(engine.getSnapshot().gold).toBeLessThan(startGold);

    // LaserTower damage matches displayed stat and caps at Lv.3
    const laser = new LaserTower(99, 0, 0, 48, false);
    const dummy = new NormalEnemy(1, 1, [{ row: 0, col: 0 }, { row: 0, col: 5 }], 48);
    expect(laser.executeAttack(dummy).damage).toBe(laser.damage);
    expect(laser.upgrade()).toBeGreaterThan(0);
    expect(laser.upgrade()).toBeGreaterThan(0);
    expect(laser.canUpgrade()).toBe(false);

    // 1x (300 ticks @ 0.02s = 6s) vs 3x (100 ticks @ 0.02s = 6s) parity
    const eng1x = new GameEngine('circuit-valley', 'standard', 'quick');
    const eng3x = new GameEngine('circuit-valley', 'standard', 'quick');
    eng1x.placeTower('basic', cell!.row, cell!.col);
    eng3x.placeTower('basic', cell!.row, cell!.col);
    eng1x.setSpeed(1);
    eng3x.setSpeed(3);
    eng1x.startNextWave();
    eng3x.startNextWave();
    for (let i = 0; i < 300; i++) eng1x.update(0.02);
    for (let i = 0; i < 100; i++) eng3x.update(0.02);
    expect(eng3x.getSnapshot().enemiesDefeated).toBe(eng1x.getSnapshot().enemiesDefeated);
    expect(eng3x.getSnapshot().gold).toBe(eng1x.getSnapshot().gold);
  });
});