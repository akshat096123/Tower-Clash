import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Coins,
  Flag,
  Play,
  Settings,
  Shield,
  Skull,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { DifficultyLevel, GraphicsQuality, PageRoute, TowerType } from '../types/game';
import { GAME_MAPS } from '../engine/maps';
import { DIFFICULTY_PRESETS } from '../engine/balance';
import { GameThreeRenderer } from '../engine/GameThreeRenderer';
import { TOWER_CATALOG } from '../engine/Tower';
import { soundFX } from '../engine/soundFx';

export interface PlayerProfileData {
  name: string;
  xp: number;
  level: number;
  games_played: number;
  games_won: number;
  total_enemies_defeated: number;
  highest_wave: number;
  total_gold_earned: number;
  achievements: string[];
}

export interface GameHistoryRecord {
  id: number;
  map_name: string;
  difficulty: string;
  victory: boolean;
  wave_reached: number;
  total_waves: number;
  enemies_defeated: number;
  gold_earned: number;
  towers_built: number;
  base_health_remaining: number;
  duration_sec: number;
  targeting_algo: string;
  created_at: string;
}

interface HomeDashboardProps {
  profile: PlayerProfileData;
  recentGames: GameHistoryRecord[];
  selectedMapId: string;
  selectedDifficulty: DifficultyLevel;
  graphicsQuality?: GraphicsQuality;
  onStartBattle: (mapId: string, difficulty: DifficultyLevel) => void;
  onNavigate: (route: PageRoute) => void;
  onOpenDiagrams: () => void;
}

const DIFFICULTY_META: Record<
  DifficultyLevel,
  { label: string; coins: number; summary: string; pillClass: string }
> = {
  recruit: {
    label: DIFFICULTY_PRESETS.recruit.label,
    coins: DIFFICULTY_PRESETS.recruit.startingGold,
    summary: DIFFICULTY_PRESETS.recruit.subtitle,
    pillClass: 'border-emerald-400/50 bg-emerald-950/60 text-emerald-200 hover:bg-emerald-900/70',
  },
  standard: {
    label: DIFFICULTY_PRESETS.standard.label,
    coins: DIFFICULTY_PRESETS.standard.startingGold,
    summary: DIFFICULTY_PRESETS.standard.subtitle,
    pillClass: 'border-amber-400/60 bg-amber-950/60 text-amber-200 hover:bg-amber-900/70',
  },
  veteran: {
    label: DIFFICULTY_PRESETS.veteran.label,
    coins: DIFFICULTY_PRESETS.veteran.startingGold,
    summary: DIFFICULTY_PRESETS.veteran.subtitle,
    pillClass: 'border-orange-400/60 bg-orange-950/60 text-orange-200 hover:bg-orange-900/70',
  },
  nightmare: {
    label: DIFFICULTY_PRESETS.nightmare.label,
    coins: DIFFICULTY_PRESETS.nightmare.startingGold,
    summary: DIFFICULTY_PRESETS.nightmare.subtitle,
    pillClass: 'border-rose-400/60 bg-rose-950/60 text-rose-200 hover:bg-rose-900/70',
  },
};

const REALM_BOSS_PREVIEW: Record<string, string> = {
  'circuit-valley': 'Boss: Kernel Overlord',
  'bifurcation-nexus': 'Boss: Sand Warlord',
  'spiral-citadel': 'Boss: Frost Wyvern',
  'eulerian-citadel': 'Boss: Magma Overlord',
};

const ROTATING_TIPS = [
  'Tip: Click any buildable green tile in battle to summon heroes or open the radial build wheel.',
  'Tip: Upgrade key heroes up to Lv.3 and switch targeting priority (First, Strongest, Weakest) anytime.',
  'Tip: Use Meteor [Q] to shatter dense waves and Frost Nova [E] to chill fast raiders before the Citadel.',
  'Tip: Switch to 3D Orbit in combat to rotate and inspect the valley from any tactical angle.',
];

const DIFF_ORDER: DifficultyLevel[] = ['recruit', 'standard', 'veteran', 'nightmare'];

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  profile,
  recentGames,
  selectedMapId,
  selectedDifficulty,
  graphicsQuality = 'high',
  onStartBattle,
  onNavigate,
  onOpenDiagrams,
}) => {
  const initialIdx = Math.max(0, GAME_MAPS.findIndex((m) => m.id === selectedMapId));
  const [stageIdx, setStageIdx] = useState(initialIdx);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(selectedDifficulty);
  const [muted, setMuted] = useState(soundFX.muted);
  const [activeModal, setActiveModal] = useState<'none' | 'guide' | 'records' | 'menu'>('none');
  const [tipIdx, setTipIdx] = useState(0);

  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const threeRef = useRef<GameThreeRenderer | null>(null);
  const modalRef = useRef<HTMLDialogElement>(null);

  const currentMap = GAME_MAPS[stageIdx] ?? GAME_MAPS[0];
  const diffMeta = DIFFICULTY_META[difficulty];

  useEffect(() => {
    setDifficulty(selectedDifficulty);
  }, [selectedDifficulty]);

  // Rotate subtle bottom tip every 6 seconds
  useEffect(() => {
    const id = window.setInterval(() => {
      setTipIdx((i) => (i + 1) % ROTATING_TIPS.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, []);

  // Full-Bleed Live 3D Battlefield Backdrop (Three.js Flyover)
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;

    const three = new GameThreeRenderer(canvas);
    three.setGraphicsQuality(graphicsQuality);
    three.setMap(GAME_MAPS[stageIdx] ?? GAME_MAPS[0]);
    three.setLobbyMode(true);
    threeRef.current = three;

    const handleResize = () => {
      const dpr = three.getRecommendedDpr();
      three.resize(Math.floor(window.innerWidth * dpr), Math.floor(window.innerHeight * dpr));
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    let rafId = 0;
    let lastTime = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.08, (now - lastTime) / 1000);
      lastTime = now;
      three.renderLobbyFrame(dt);
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      three.dispose();
      threeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Smoothly transition live 3D valley biome when switching realms
  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;
    three.setMap(currentMap);
  }, [currentMap]);

  // Sync graphics quality setting if changed
  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;
    three.setGraphicsQuality(graphicsQuality);
    const dpr = three.getRecommendedDpr();
    three.resize(Math.floor(window.innerWidth * dpr), Math.floor(window.innerHeight * dpr));
  }, [graphicsQuality]);

  useEffect(() => {
    const dlg = modalRef.current;
    if (!dlg) return;
    if (activeModal !== 'none' && !dlg.open) dlg.showModal();
    else if (activeModal === 'none' && dlg.open) dlg.close();
  }, [activeModal]);

  const cycleDifficulty = () => {
    const idx = DIFF_ORDER.indexOf(difficulty);
    setDifficulty(DIFF_ORDER[(idx + 1) % DIFF_ORDER.length]);
    soundFX.sellCoins();
  };

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden flex flex-col justify-between select-none bg-[#0b120d]">
      {/* Full-Bleed Live 3D Battlefield Flyover */}
      <canvas
        ref={bgCanvasRef}
        aria-hidden="true"
        className="fixed inset-0 block w-full h-full pointer-events-none"
      />

      {/* Soft Edge Vignette & Top/Bottom Scrims (Leaves Center Living World Clear) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_44%,rgba(5,10,8,0.58)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-44 bg-gradient-to-b from-black/55 via-black/20 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/75 via-black/30 to-transparent"
      />

      {/* TOP BAR: Sleek Translucent Stats (Left) + Utility Controls (Right) */}
      <header className="relative z-10 px-4 sm:px-6 pt-3 flex items-center justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 bg-[rgba(15,20,18,0.65)] backdrop-blur-[10px] text-amber-200 text-xs font-extrabold shadow-lg">
            <Award className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span>Commander Lv.{profile.level}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 bg-[rgba(15,20,18,0.65)] backdrop-blur-[10px] text-amber-300 text-xs font-extrabold shadow-lg">
            <Coins className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span>{profile.total_gold_earned.toLocaleString()} Coins</span>
          </div>
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 bg-[rgba(15,20,18,0.65)] backdrop-blur-[10px] text-emerald-300 text-xs font-extrabold shadow-lg">
            <Trophy className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            <span>{profile.games_won} Victories</span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            aria-label={muted ? 'Unmute game sound' : 'Mute game sound'}
            title={muted ? 'Unmute Audio' : 'Mute Audio'}
            onClick={() => {
              soundFX.muted = !muted;
              setMuted(!muted);
            }}
            className="p-2 rounded-full border border-white/15 bg-[rgba(15,20,18,0.65)] backdrop-blur-[10px] text-amber-200 hover:bg-white/15 shadow-lg transition cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-300" /> : <Volume2 className="w-4 h-4 text-emerald-300" />}
          </button>
          <button
            type="button"
            aria-label="Game settings"
            title="Game Options & Engine Tools"
            onClick={() => setActiveModal('menu')}
            className="p-2 rounded-full border border-white/15 bg-[rgba(15,20,18,0.65)] backdrop-blur-[10px] text-amber-200 hover:bg-white/15 shadow-lg transition cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* UPPER HERO CREST: Sculpted Metallic/Stone Fantasy Emblem (Center World Remains Open) */}
      <div className="relative z-10 px-4 pt-2 sm:pt-4 flex flex-col items-center pointer-events-none">
        <div className="animate-float-slow relative flex flex-col items-center text-center">
          <div className="relative px-7 sm:px-10 py-3 sm:py-3.5 rounded-2xl border-2 border-amber-400/55 bg-gradient-to-b from-[#2b1d14]/90 via-[#1b1410]/88 to-[#0e0c0b]/92 backdrop-blur-md shadow-[0_8px_0_rgba(12,8,5,0.85),0_18px_40px_rgba(0,0,0,0.75)] ring-1 ring-inset ring-amber-200/20">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-0.5 rounded-full border border-amber-300/70 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-[10px] font-black tracking-[0.18em] text-[#1d1208] uppercase shadow-md">
              Tactical Tower Defense
            </div>
            <div className="flex items-center justify-center gap-3">
              <Swords className="hidden sm:block w-6 h-6 text-amber-400/90 drop-shadow" aria-hidden="true" />
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)] leading-none">
                TOWER CLASH
              </h1>
              <Shield className="hidden sm:block w-6 h-6 text-amber-400/90 drop-shadow" aria-hidden="true" />
            </div>
            <p className="mt-1 text-[11px] sm:text-xs font-extrabold tracking-[0.28em] text-amber-100/85 uppercase">
              Realm Defense
            </p>
          </div>
        </div>
      </div>

      {/* OPEN BREATHING CENTER: Live 3D Battlefield Flyover */}
      <div className="flex-1 pointer-events-none" />

      {/* LOWER WAR-ROOM CAMPAIGN BAR & SUBTLE TIP */}
      <div className="relative z-10 px-3 sm:px-6 pb-2.5 flex flex-col items-center gap-2 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-5xl rounded-2xl border border-amber-200/20 bg-[rgba(15,20,18,0.74)] backdrop-blur-[12px] p-3 sm:px-5 sm:py-3.5 shadow-[0_14px_40px_rgba(0,0,0,0.75)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Left: Realm Switcher (< / >) + Name & Concise Summary */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Previous realm"
              onClick={() => setStageIdx((i) => (i - 1 + GAME_MAPS.length) % GAME_MAPS.length)}
              className="shrink-0 p-2 rounded-xl border border-white/15 bg-black/40 hover:bg-white/15 text-amber-200 transition cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                <span className="text-[10px] font-black tracking-[0.16em] text-amber-400 uppercase">
                  Valley {stageIdx + 1} of {GAME_MAPS.length}
                </span>
                <span className="text-[10px] font-bold text-stone-400">• {currentMap.difficultyRating}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-amber-100 truncate">
                {currentMap.name}
              </h2>
              <p className="hidden sm:block text-xs text-stone-300/90 line-clamp-1">
                {currentMap.description}
              </p>
            </div>

            <button
              type="button"
              aria-label="Next realm"
              onClick={() => setStageIdx((i) => (i + 1) % GAME_MAPS.length)}
              className="shrink-0 p-2 rounded-xl border border-white/15 bg-black/40 hover:bg-white/15 text-amber-200 transition cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Center: Crisp Stat Chips (Waves, Boss Preview, Interactive Difficulty + Starting Coins) */}
          <div className="flex flex-wrap items-center gap-1.5 lg:justify-center">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-sky-400/30 bg-sky-950/50 text-sky-100 text-xs font-extrabold">
              <Flag className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
              <span>{currentMap.wavesCount} Waves</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-rose-400/30 bg-rose-950/50 text-rose-100 text-xs font-extrabold">
              <Skull className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
              <span>{REALM_BOSS_PREVIEW[currentMap.id] ?? 'Boss: Warlord'}</span>
            </span>

            <button
              type="button"
              onClick={cycleDifficulty}
              title={`Click to cycle difficulty (${diffMeta.summary})`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-extrabold transition cursor-pointer ${diffMeta.pillClass}`}
            >
              <span>Difficulty: {diffMeta.label}</span>
              <span className="opacity-70">•</span>
              <Coins className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              <span>{diffMeta.coins} Coins</span>
            </button>
          </div>

          {/* Right: Quick Drawers (Towers & Records) + Bold BEGIN CTA */}
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveModal('guide')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/15 bg-black/40 hover:bg-white/15 text-amber-200 text-xs font-extrabold transition cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>Towers &amp; Monsters</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('records')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/15 bg-black/40 hover:bg-white/15 text-amber-200 text-xs font-extrabold transition cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>Battle Records ({recentGames.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundFX.waveStart();
                onStartBattle(currentMap.id, difficulty);
              }}
              className="btn-game-green px-6 py-2.5 rounded-xl text-base sm:text-lg font-black tracking-wide text-white game-text-outline inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" aria-hidden="true" />
              <span>Begin</span>
            </button>
          </div>
        </div>

        {/* Subtle Bottom Rotating Tip */}
        <p className="text-[11px] font-medium text-amber-100/75 text-center truncate max-w-[92vw]">
          {ROTATING_TIPS[tipIdx]}
        </p>
      </div>

      {/* Modal Dialog for Towers & Monsters / Battle Records / Game Options */}
      <dialog
        ref={modalRef}
        aria-labelledby="lobby-modal-title"
        onClose={() => setActiveModal('none')}
        className="w-full max-w-2xl p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-amber-800/40 pb-3 mb-4">
          <h2 id="lobby-modal-title" className="text-lg font-black text-amber-300">
            {activeModal === 'guide' && 'Kingdom Armory — Towers & Monsters'}
            {activeModal === 'records' && 'Recent Battle Victories & Logs'}
            {activeModal === 'menu' && 'Game Options'}
          </h2>
          <button
            type="button"
            onClick={() => setActiveModal('none')}
            aria-label="Close modal"
            className="p-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-amber-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {activeModal === 'guide' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60dvb] overflow-y-auto app-scroll pr-1">
            {(Object.keys(TOWER_CATALOG) as TowerType[]).map((type) => {
              const t = TOWER_CATALOG[type];
              return (
                <div key={type} className="rounded-xl border border-amber-700/40 bg-[#120d08] p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-100 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.name}
                    </span>
                    <span className="text-xs font-extrabold text-amber-300">{t.cost} Coins</span>
                  </div>
                  <p className="text-xs text-stone-300">{t.description}</p>
                  <p className="text-[11px] font-bold text-emerald-300">
                    DMG {t.damage} • Range {t.range} • Speed {t.attackSpeed}/s
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {activeModal === 'records' && (
          <div className="space-y-2 max-h-[60dvb] overflow-y-auto app-scroll">
            {recentGames.length === 0 ? (
              <p className="text-sm text-stone-300 py-6 text-center">
                No battles completed yet — hit Begin to defend the valley!
              </p>
            ) : (
              recentGames.slice(0, 12).map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded-xl border border-amber-800/35 bg-[#120d08] px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <p className="font-bold text-amber-100">
                      {g.map_name}{' '}
                      <span className={g.victory ? 'text-emerald-400' : 'text-rose-400'}>
                        ({g.victory ? 'Victory' : 'Defeat'})
                      </span>
                    </p>
                    <p className="text-stone-400 capitalize">
                      {g.difficulty} • Wave {g.wave_reached}/{g.total_waves}
                    </p>
                  </div>
                  <div className="text-right font-bold">
                    <div className="text-amber-300">{g.gold_earned} Coins</div>
                    <div className="text-stone-400 flex items-center justify-end gap-1">
                      <Skull className="w-3 h-3" /> {g.enemies_defeated}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeModal === 'menu' && (
          <div className="space-y-4 text-sm">
            <p className="text-stone-300 text-xs">
              Configure audio, default campaign settings, or inspect the underlying engine modules.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setActiveModal('none');
                  onNavigate('settings');
                }}
                className="px-4 py-2.5 rounded-xl border border-amber-700/50 bg-[#120d08] hover:bg-[#231910] text-amber-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                Full Preferences
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveModal('none');
                  onOpenDiagrams();
                }}
                className="px-4 py-2.5 rounded-xl border border-amber-700/50 bg-[#120d08] hover:bg-[#231910] text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                Engine Architecture
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveModal('none');
                  onNavigate('lab');
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Algorithm Sandbox
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveModal('none');
                  onNavigate('performance');
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Engine Benchmarks
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
};
