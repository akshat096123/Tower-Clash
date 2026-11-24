import { DifficultyLevel, EnemyType, TowerType } from '../types/game';

export interface DifficultyPreset {
  id: DifficultyLevel;
  label: string;
  subtitle: string;
  hpMult: number;
  speedMult: number;
  startingGold: number;
  rewardMult: number;
  startHealth: number;
  countMult: number;
}

export const DIFFICULTY_PRESETS: Record<DifficultyLevel, DifficultyPreset> = {
  recruit: {
    id: 'recruit',
    label: 'Peasant',
    subtitle: 'Casual • 0.75x HP • 0.9x Speed',
    hpMult: 0.75,
    speedMult: 0.9,
    startingGold: 250, // +19% vs Medium 210
    rewardMult: 1.0,
    startHealth: 100,
    countMult: 0.9,
  },
  standard: {
    id: 'standard',
    label: 'Warrior',
    subtitle: 'Medium • 1.0x HP • 1.0x Speed',
    hpMult: 1.0,
    speedMult: 1.0,
    startingGold: 210,
    rewardMult: 1.0,
    startHealth: 100,
    countMult: 1.0,
  },
  veteran: {
    id: 'veteran',
    label: 'Knight',
    subtitle: 'Hard • 1.35x HP • 1.12x Speed • -10% Gold',
    hpMult: 1.35,
    speedMult: 1.12,
    startingGold: 190,
    rewardMult: 0.9,
    startHealth: 100,
    countMult: 1.1,
  },
  nightmare: {
    id: 'nightmare',
    label: 'Overlord',
    subtitle: 'Extreme • 1.65x HP • 1.18x Speed • -15% Gold',
    hpMult: 1.65,
    speedMult: 1.18,
    startingGold: 175,
    rewardMult: 0.85,
    startHealth: 85,
    countMult: 1.2,
  },
};

export const BASE_BOT_HP = 138;
export const BASE_BOT_SPEED = 76;
export const WAVE_HP_EXPONENT = 1.135;

export interface EnemyArchetypeSpec {
  type: EnemyType;
  name: string;
  roleLabel: string;
  hpMult: number;
  speedMult: number;
  armor: number;
  reward: number;
  leakDamage: number;
  isFlying: boolean;
  description: string;
}

export const ENEMY_ARCHETYPES: Record<EnemyType, EnemyArchetypeSpec> = {
  swarm: {
    type: 'swarm',
    name: 'Bog Swarmling',
    roleLabel: 'Swarmling',
    hpMult: 0.35,
    speedMult: 1.22,
    armor: 0,
    reward: 6,
    leakDamage: 3,
    isFlying: false,
    description: 'Tiny pack-spawning crawler (0.35x HP); punishes single-target spam and rewards AoE/Splash.',
  },
  fast: {
    type: 'fast',
    name: 'Shadow Wolf',
    roleLabel: 'Scout / Runner',
    hpMult: 0.55,
    speedMult: 1.35,
    armor: 0,
    reward: 10,
    leakDamage: 5,
    isFlying: false,
    description: 'High-velocity scout (1.35x speed, 0.55x HP) that slips past slow sniper towers.',
  },
  normal: {
    type: 'normal',
    name: 'Goblin Raider',
    roleLabel: 'Grunt / Footman',
    hpMult: 1.0,
    speedMult: 1.0,
    armor: 2,
    reward: 14,
    leakDamage: 6,
    isFlying: false,
    description: 'Balanced frontline baseline (1.0x HP, 1.0x speed, light 2 armor).',
  },
  flying: {
    type: 'flying',
    name: 'Winged Gargoyle',
    roleLabel: 'Air Skirmisher',
    hpMult: 0.9,
    speedMult: 1.2,
    armor: 3,
    reward: 17,
    leakDamage: 7,
    isFlying: true,
    description: 'Airborne predator bypassing road twists and slow terrain.',
  },
  armored: {
    type: 'armored',
    name: 'Orc Vanguard',
    roleLabel: 'Armored Brute',
    hpMult: 2.65,
    speedMult: 0.68,
    armor: 14,
    reward: 28,
    leakDamage: 10,
    isFlying: false,
    description: 'Heavy iron shield grants 14 armor; demands Shadow Ranger piercing or Sorceress magic.',
  },
  heavy: {
    type: 'heavy',
    name: 'Stone Golem',
    roleLabel: 'Heavy Tank',
    hpMult: 3.15,
    speedMult: 0.64,
    armor: 8,
    reward: 32,
    leakDamage: 12,
    isFlying: false,
    description: 'High-HP juggernaut (3.15x HP) requiring Frost slows and focused DPS.',
  },
  witch: {
    type: 'witch',
    name: 'Shadow Witch',
    roleLabel: 'Arcane Shielder',
    hpMult: 2.4,
    speedMult: 0.85,
    armor: 4,
    reward: 38,
    leakDamage: 12,
    isFlying: false,
    description: 'Periodically activates an arcane ward reducing incoming damage by 40%.',
  },
  dragon: {
    type: 'dragon',
    name: 'Ancient Wyvern',
    roleLabel: 'Mini-Boss',
    hpMult: 8.0,
    speedMult: 0.95,
    armor: 8,
    reward: 80,
    leakDamage: 18,
    isFlying: true,
    description: 'Airborne mini-boss (8.0x HP) with partial frost resistance.',
  },
  boss: {
    type: 'boss',
    name: 'Kernel Overlord',
    roleLabel: 'Warlord Boss',
    hpMult: 12.0,
    speedMult: 0.55,
    armor: 12,
    reward: 160,
    leakDamage: 25,
    isFlying: false,
    description: 'Colossal wave warlord (12.0x HP) alternating between Shield Pulse and steady regeneration.',
  },
};

export function computeScaledBotHp(
  waveNumber: number,
  role: EnemyType,
  difficulty: DifficultyLevel
): number {
  const diff = DIFFICULTY_PRESETS[difficulty] ?? DIFFICULTY_PRESETS.standard;
  const spec = ENEMY_ARCHETYPES[role] ?? ENEMY_ARCHETYPES.normal;
  const waveFactor = Math.pow(WAVE_HP_EXPONENT, Math.max(0, waveNumber - 1));
  return Math.max(1, Math.round(BASE_BOT_HP * spec.hpMult * waveFactor * diff.hpMult));
}

export function computeScaledBotSpeed(role: EnemyType, difficulty: DifficultyLevel): number {
  const diff = DIFFICULTY_PRESETS[difficulty] ?? DIFFICULTY_PRESETS.standard;
  const spec = ENEMY_ARCHETYPES[role] ?? ENEMY_ARCHETYPES.normal;
  return Math.max(18, Math.round(BASE_BOT_SPEED * spec.speedMult * diff.speedMult));
}

export function computeScaledBotReward(role: EnemyType, difficulty: DifficultyLevel): number {
  const diff = DIFFICULTY_PRESETS[difficulty] ?? DIFFICULTY_PRESETS.standard;
  const spec = ENEMY_ARCHETYPES[role] ?? ENEMY_ARCHETYPES.normal;
  return Math.max(1, Math.round(spec.reward * diff.rewardMult));
}

export const MAX_TOWER_LEVEL = 3;
export const TOWER_SELL_REFUND_RATE = 0.75;
export const TOWER_UPGRADE_COST_MULTS = [0.85, 1.55] as const; // Lv1->2 (0.85x base), Lv2->3 (1.55x base)
export const TOWER_DAMAGE_MULTS = [1.0, 1.42, 1.98] as const;
export const TOWER_SPEED_MULTS = [1.0, 1.18, 1.4] as const;
export const TOWER_RANGE_MULTS = [1.0, 1.1, 1.2] as const;

export const SPELL_BALANCE = {
  meteorCooldownSec: 36,
  meteorRadius: 135,
  meteorBaseDamage: 165,
  meteorWaveDamage: 24,
  meteorBurnDps: 22,
  meteorBurnDuration: 3.0,
  frostCooldownSec: 28,
  frostSlowFactor: 0.45,
  frostSlowDuration: 4.0,
  frostBaseDamage: 30,
  frostWaveDamage: 7,
} as const;

export const ECONOMY_BALANCE = {
  cheapestTowerCost: 75,
  earlyWaveBonusGold: 15,
  crystalDividendGold: 15,
  crystalDividendIntervalSec: 12,
  waveClearBaseGold: 38,
  waveClearPerWaveGold: 7,
} as const;

export const TOWER_BALANCE_ORDER: TowerType[] = ['basic', 'rapid', 'slow', 'sniper', 'splash', 'laser'];
