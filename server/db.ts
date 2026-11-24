import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

function resolveWritableDataDir(): string {
  const candidates = [
    process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : null,
    process.env.VERCEL || process.env.VERCEL_ENV ? path.join(os.tmpdir(), 'tower-clash-data') : null,
    path.resolve(process.cwd(), 'data'),
    path.join(os.tmpdir(), 'tower-clash-data'),
  ].filter((p): p is string => Boolean(p));

  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      // Try next directory (e.g. read-only /var/task on serverless)
    }
  }
  return os.tmpdir();
}

const dataDir = resolveWritableDataDir();
const dbPath = path.join(dataDir, 'dsa_defense.sqlite');
export const db = new DatabaseSync(dbPath);

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS player_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT 'Commander',
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      games_played INTEGER NOT NULL DEFAULT 0,
      games_won INTEGER NOT NULL DEFAULT 0,
      total_enemies_defeated INTEGER NOT NULL DEFAULT 0,
      highest_wave INTEGER NOT NULL DEFAULT 0,
      total_gold_earned INTEGER NOT NULL DEFAULT 0,
      achievements_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO player_profile (id, name, xp, level, games_played, games_won, total_enemies_defeated, highest_wave, total_gold_earned, achievements_json)
    VALUES (1, 'Commander', 0, 1, 0, 0, 0, 0, 0, '[]');

    CREATE TABLE IF NOT EXISTS game_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      map_id TEXT NOT NULL,
      map_name TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      victory INTEGER NOT NULL,
      wave_reached INTEGER NOT NULL,
      total_waves INTEGER NOT NULL,
      enemies_defeated INTEGER NOT NULL,
      gold_earned INTEGER NOT NULL,
      towers_built INTEGER NOT NULL,
      base_health_remaining INTEGER NOT NULL,
      duration_sec REAL NOT NULL,
      targeting_algo TEXT NOT NULL,
      dsa_metrics_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS benchmark_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      engine TEXT NOT NULL,
      category TEXT NOT NULL,
      pattern TEXT NOT NULL,
      input_size INTEGER NOT NULL,
      results_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES ('defaultDifficulty', 'standard');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('defaultSortAlgo', 'quick');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('benchmarkEngine', 'cpp');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('reducedMotion', 'false');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('showSpatialGrid', 'true');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('graphicsQuality', 'high');
  `);
}
