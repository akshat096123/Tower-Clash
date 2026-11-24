import type { GameHistoryRecord, PlayerProfileData } from '../pages/HomeDashboard';
import type { AppSettings } from '../pages/SettingsPage';

const SESSIONS_KEY = 'tower_clash.sessions.v1';
const PROFILE_KEY = 'tower_clash.profile.v1';
const SETTINGS_KEY = 'tower_clash.settings.v1';
const MAX_STORED_SESSIONS = 100;

export const DEFAULT_LOCAL_PROFILE: PlayerProfileData = {
  name: 'Commander',
  xp: 0,
  level: 1,
  games_played: 0,
  games_won: 0,
  total_enemies_defeated: 0,
  highest_wave: 0,
  total_gold_earned: 0,
  achievements: [],
};

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function sessionSignature(s: GameHistoryRecord): string {
  return [
    s.map_name,
    s.difficulty,
    s.victory ? 1 : 0,
    s.wave_reached,
    s.total_waves,
    s.enemies_defeated,
    s.gold_earned,
    s.towers_built,
    s.base_health_remaining,
    Math.round(s.duration_sec),
    s.targeting_algo,
  ].join('|');
}

function toEpochMs(ts: string): number {
  const normalized = ts.includes('T') ? ts : `${ts.replace(' ', 'T')}Z`;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function loadLocalSessions(): GameHistoryRecord[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GameHistoryRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalSessions(sessions: GameHistoryRecord[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, MAX_STORED_SESSIONS)));
  } catch {
    // Ignore storage quota errors
  }
}

export function mergeSessions(
  serverSessions: GameHistoryRecord[],
  localSessions: GameHistoryRecord[]
): GameHistoryRecord[] {
  const merged: GameHistoryRecord[] = [];
  const seen: GameHistoryRecord[] = [];

  const addIfUnique = (candidate: GameHistoryRecord) => {
    const sig = sessionSignature(candidate);
    const candMs = toEpochMs(candidate.created_at);
    const duplicate = seen.some((existing) => {
      if (sessionSignature(existing) !== sig) return false;
      const exMs = toEpochMs(existing.created_at);
      if (candMs === 0 || exMs === 0) return existing.id === candidate.id;
      return Math.abs(candMs - exMs) < 120_000;
    });
    if (!duplicate) {
      seen.push(candidate);
      merged.push(candidate);
    }
  };

  // Prefer authoritative server rows first, then keep locally persisted sessions
  for (const s of serverSessions) addIfUnique(s);
  for (const s of localSessions) addIfUnique(s);

  merged.sort((a, b) => {
    const tDiff = toEpochMs(b.created_at) - toEpochMs(a.created_at);
    if (tDiff !== 0) return tDiff;
    return b.id - a.id;
  });

  return merged.slice(0, MAX_STORED_SESSIONS);
}

export function loadLocalProfile(): PlayerProfileData | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlayerProfileData;
  } catch {
    return null;
  }
}

export function saveLocalProfile(profile: PlayerProfileData): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

export function mergeProfiles(
  serverProfile: PlayerProfileData | null,
  localProfile: PlayerProfileData | null
): PlayerProfileData {
  if (!serverProfile && !localProfile) return DEFAULT_LOCAL_PROFILE;
  if (!serverProfile) return localProfile!;
  if (!localProfile) return serverProfile;

  const xp = Math.max(serverProfile.xp ?? 0, localProfile.xp ?? 0);
  const level = Math.max(
    serverProfile.level ?? 1,
    localProfile.level ?? 1,
    Math.floor(Math.sqrt(xp / 100)) + 1
  );
  const achievements = Array.from(
    new Set([...(serverProfile.achievements ?? []), ...(localProfile.achievements ?? [])])
  );

  return {
    name: serverProfile.name || localProfile.name || 'Commander',
    xp,
    level,
    games_played: Math.max(serverProfile.games_played ?? 0, localProfile.games_played ?? 0),
    games_won: Math.max(serverProfile.games_won ?? 0, localProfile.games_won ?? 0),
    total_enemies_defeated: Math.max(
      serverProfile.total_enemies_defeated ?? 0,
      localProfile.total_enemies_defeated ?? 0
    ),
    highest_wave: Math.max(serverProfile.highest_wave ?? 0, localProfile.highest_wave ?? 0),
    total_gold_earned: Math.max(serverProfile.total_gold_earned ?? 0, localProfile.total_gold_earned ?? 0),
    achievements,
  };
}

export function recordMatchLocally(record: GameHistoryRecord): {
  sessions: GameHistoryRecord[];
  profile: PlayerProfileData;
} {
  const existingSessions = loadLocalSessions();
  const nextSessions = mergeSessions([record], existingSessions);
  saveLocalSessions(nextSessions);

  const prev = loadLocalProfile() ?? DEFAULT_LOCAL_PROFILE;
  const gainedXp =
    record.enemies_defeated * 5 + record.wave_reached * 30 + (record.victory ? 250 : 25);
  const nextXp = prev.xp + gainedXp;
  const nextLevel = Math.floor(Math.sqrt(nextXp / 100)) + 1;
  const nextPlayed = prev.games_played + 1;
  const nextWon = prev.games_won + (record.victory ? 1 : 0);
  const nextEnemies = prev.total_enemies_defeated + record.enemies_defeated;
  const nextHighestWave = Math.max(prev.highest_wave, record.wave_reached);
  const nextGold = prev.total_gold_earned + record.gold_earned;

  const achievements = new Set<string>(prev.achievements ?? []);
  if (nextPlayed >= 1) achievements.add('First Deployment');
  if (record.victory) achievements.add('Algorithmic Victory');
  if (nextEnemies >= 100) achievements.add('Century Eliminator');
  if (nextHighestWave >= 10) achievements.add('Wave Master');
  if (record.towers_built >= 10) achievements.add('Grid Architect');
  if (record.victory && record.base_health_remaining >= 100) achievements.add('Zero Packet Loss');

  const nextProfile: PlayerProfileData = {
    name: prev.name || 'Commander',
    xp: nextXp,
    level: nextLevel,
    games_played: nextPlayed,
    games_won: nextWon,
    total_enemies_defeated: nextEnemies,
    highest_wave: nextHighestWave,
    total_gold_earned: nextGold,
    achievements: [...achievements],
  };
  saveLocalProfile(nextProfile);

  return { sessions: nextSessions, profile: nextProfile };
}

export function loadLocalSettings(): AppSettings | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as AppSettings) : null;
  } catch {
    return null;
  }
}

export function saveLocalSettings(settings: AppSettings): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearLocalTelemetry(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(SESSIONS_KEY);
    storage.removeItem(PROFILE_KEY);
  } catch {
    // Ignore storage errors
  }
}
