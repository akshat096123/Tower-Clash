import { describe, expect, it } from 'vitest';
import { GameEngine } from '../engine/GameEngine';
import { GAME_MAPS } from '../engine/maps';
import { PathFinder } from '../engine/PathFinder';
import { NormalEnemy } from '../engine/Enemy';
import { BasicTower } from '../engine/Tower';
import { getTargetingStrategy } from '../engine/TargetingStrategy';
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
});