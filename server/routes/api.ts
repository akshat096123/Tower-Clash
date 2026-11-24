import { Router } from 'express';
import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { db } from '../db.ts';

export const apiRouter = Router();

const CPP_BIN = path.resolve(process.cwd(), 'cpp/build/dsa_engine');

function runCppBinary(args: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(CPP_BIN)) {
      reject(new Error('C++ engine binary not built. Run `make -C cpp`.'));
      return;
    }
    execFile(CPP_BIN, args, { timeout: 20000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (parseErr) {
        reject(new Error(`Invalid JSON from C++ engine: ${String(parseErr)}`));
      }
    });
  });
}

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, cppReady: fs.existsSync(CPP_BIN) });
});

apiRouter.get('/profile', (_req, res) => {
  const row = db.prepare('SELECT * FROM player_profile WHERE id = 1').get() as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  res.json({
    ...row,
    achievements: JSON.parse(String(row.achievements_json || '[]')),
  });
});

apiRouter.post('/game-sessions', (req, res) => {
  const body = req.body ?? {};
  const mapId = String(body.mapId ?? 'circuit-valley');
  const mapName = String(body.mapName ?? 'Circuit Valley');
  const difficulty = String(body.difficulty ?? 'standard');
  const victory = body.victory ? 1 : 0;
  const waveReached = Math.max(0, Number(body.waveReached ?? 0));
  const totalWaves = Math.max(1, Number(body.totalWaves ?? 10));
  const enemiesDefeated = Math.max(0, Number(body.enemiesDefeated ?? 0));
  const goldEarned = Math.max(0, Number(body.goldEarned ?? 0));
  const towersBuilt = Math.max(0, Number(body.towersBuilt ?? 0));
  const baseHealthRemaining = Math.max(0, Number(body.baseHealthRemaining ?? 0));
  const durationSec = Math.max(0, Number(body.durationSec ?? 0));
  const targetingAlgo = String(body.targetingAlgo ?? 'quick');
  const dsaMetricsJson = JSON.stringify(body.dsaMetrics ?? {});

  const insertStmt = db.prepare(`
    INSERT INTO game_history (
      map_id, map_name, difficulty, victory, wave_reached, total_waves,
      enemies_defeated, gold_earned, towers_built, base_health_remaining,
      duration_sec, targeting_algo, dsa_metrics_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = insertStmt.run(
    mapId, mapName, difficulty, victory, waveReached, totalWaves,
    enemiesDefeated, goldEarned, towersBuilt, baseHealthRemaining,
    durationSec, targetingAlgo, dsaMetricsJson
  );

  // Update player profile & achievements
  const profile = db.prepare('SELECT * FROM player_profile WHERE id = 1').get() as Record<string, unknown>;
  const prevXp = Number(profile.xp ?? 0);
  const gainedXp = enemiesDefeated * 5 + waveReached * 30 + (victory ? 250 : 25);
  const newXp = prevXp + gainedXp;
  const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1;
  const gamesPlayed = Number(profile.games_played ?? 0) + 1;
  const gamesWon = Number(profile.games_won ?? 0) + victory;
  const totalEnemies = Number(profile.total_enemies_defeated ?? 0) + enemiesDefeated;
  const highestWave = Math.max(Number(profile.highest_wave ?? 0), waveReached);
  const totalGold = Number(profile.total_gold_earned ?? 0) + goldEarned;

  const existingAchievements = new Set<string>(JSON.parse(String(profile.achievements_json || '[]')));
  if (gamesPlayed >= 1) existingAchievements.add('First Deployment');
  if (victory === 1) existingAchievements.add('Algorithmic Victory');
  if (totalEnemies >= 100) existingAchievements.add('Century Eliminator');
  if (highestWave >= 10) existingAchievements.add('Wave Master');
  if (towersBuilt >= 10) existingAchievements.add('Grid Architect');
  if (victory === 1 && baseHealthRemaining >= 100) existingAchievements.add('Zero Packet Loss');

  db.prepare(`
    UPDATE player_profile SET
      xp = ?, level = ?, games_played = ?, games_won = ?,
      total_enemies_defeated = ?, highest_wave = ?, total_gold_earned = ?,
      achievements_json = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(
    newXp, newLevel, gamesPlayed, gamesWon, totalEnemies, highestWave, totalGold,
    JSON.stringify([...existingAchievements])
  );

  res.status(201).json({
    id: result.lastInsertRowid,
    gainedXp,
    level: newLevel,
    achievements: [...existingAchievements],
  });
});

apiRouter.get('/game-sessions', (_req, res) => {
  const rows = db.prepare('SELECT * FROM game_history ORDER BY id DESC LIMIT 50').all() as Array<Record<string, unknown>>;
  res.json(
    rows.map((r) => ({
      ...r,
      victory: Boolean(r.victory),
      dsaMetrics: JSON.parse(String(r.dsa_metrics_json || '{}')),
    }))
  );
});

apiRouter.delete('/game-sessions', (_req, res) => {
  db.exec(`
    DELETE FROM game_history;
    DELETE FROM benchmark_runs;
    UPDATE player_profile SET
      xp = 0, level = 1, games_played = 0, games_won = 0,
      total_enemies_defeated = 0, highest_wave = 0, total_gold_earned = 0,
      achievements_json = '[]', updated_at = CURRENT_TIMESTAMP
    WHERE id = 1;
  `);
  res.json({ ok: true });
});

apiRouter.get('/benchmarks/run', async (req, res) => {
  try {
    const category = String(req.query.category ?? 'sorting');
    const size = Math.min(10000, Math.max(10, Number(req.query.size ?? 1000)));
    const pattern = String(req.query.pattern ?? 'random');
    const trials = Math.min(5, Math.max(1, Number(req.query.trials ?? 3)));

    const allowedCategories = new Set(['sorting', 'searching', 'trees', 'graphs']);
    const allowedPatterns = new Set(['random', 'sorted', 'reversed', 'best', 'average', 'worst', 'sparse']);
    if (!allowedCategories.has(category)) {
      res.status(400).json({ error: 'Invalid benchmark category' });
      return;
    }
    const safePattern = allowedPatterns.has(pattern) ? pattern : 'random';

    const modeMap: Record<string, string> = {
      sorting: 'benchmark_sort',
      searching: 'benchmark_search',
      trees: 'benchmark_trees',
      graphs: 'benchmark_graphs',
    };

    const args =
      category === 'sorting'
        ? [modeMap[category], String(size), safePattern, String(trials)]
        : category === 'graphs'
        ? [modeMap[category], String(Math.min(size, 500))]
        : [modeMap[category], String(size), safePattern];

    const data = await runCppBinary(args);

    db.prepare(`
      INSERT INTO benchmark_runs (engine, category, pattern, input_size, results_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(String(data.engine ?? 'C++17'), category, safePattern, size, JSON.stringify(data.results ?? []));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.get('/benchmarks/history', (_req, res) => {
  const rows = db.prepare('SELECT * FROM benchmark_runs ORDER BY id DESC LIMIT 30').all() as Array<Record<string, unknown>>;
  res.json(
    rows.map((r) => ({
      ...r,
      results: JSON.parse(String(r.results_json || '[]')),
    }))
  );
});

apiRouter.get('/settings', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const obj: Record<string, string> = {};
  for (const r of rows) obj[r.key] = r.value;
  res.json(obj);
});

apiRouter.put('/settings', (req, res) => {
  const body = req.body ?? {};
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(body)) {
    stmt.run(String(k), String(v));
  }
  res.json({ ok: true });
});
