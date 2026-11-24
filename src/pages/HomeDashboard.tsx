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
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { DifficultyLevel, PageRoute, TowerType } from '../types/game';
import { GAME_MAPS } from '../engine/maps';
import { renderMenuBackdrop } from '../engine/GameCanvasRenderer';
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
  onStartBattle: (mapId: string, difficulty: DifficultyLevel) => void;
  onNavigate: (route: PageRoute) => void;
  onOpenDiagrams: () => void;
}

const DIFFICULTY_META: Record<DifficultyLevel, { label: string; tag: string; color: string }> = {
  recruit: { label: 'Peasant', tag: 'Gentler raids • 320 Coins', color: 'bg-[#4fb328] text-white' },
  standard: { label: 'Warrior', tag: 'Balanced siege • 260 Coins', color: 'bg-[#2c8a3e] text-white' },
  veteran: { label: 'Knight', tag: 'Armored legions • 220 Coins', color: 'bg-[#d97706] text-white' },
  nightmare: { label: 'Overlord', tag: 'Relentless horde • 190 Coins', color: 'bg-[#b91c1c] text-white' },
};

const DIFF_ORDER: DifficultyLevel[] = ['recruit', 'standard', 'veteran', 'nightmare'];

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  profile,
  recentGames,
  selectedMapId,
  selectedDifficulty,
  onStartBattle,
  onNavigate,
  onOpenDiagrams,
}) => {
  const initialIdx = Math.max(0, GAME_MAPS.findIndex((m) => m.id === selectedMapId));
  const [stageIdx, setStageIdx] = useState(initialIdx);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(selectedDifficulty);
  const [muted, setMuted] = useState(soundFX.muted);
  const [activeModal, setActiveModal] = useState<'none' | 'guide' | 'records' | 'menu'>('none');

  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const modalRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setDifficulty(selectedDifficulty);
  }, [selectedDifficulty]);

  // 60fps Animated Battlefield Diorama behind the Title Screen
  useEffect(() => {
    let raf = 0;
    const draw = (now: number) => {
      const canvas = bgCanvasRef.current;
      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          renderMenuBackdrop(ctx, w, h, now);
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const dlg = modalRef.current;
    if (!dlg) return;
    if (activeModal !== 'none' && !dlg.open) dlg.showModal();
    else if (activeModal === 'none' && dlg.open) dlg.close();
  }, [activeModal]);

  const currentMap = GAME_MAPS[stageIdx] ?? GAME_MAPS[0];
  const diffMeta = DIFFICULTY_META[difficulty];

  const cycleDifficulty = () => {
    const idx = DIFF_ORDER.indexOf(difficulty);
    setDifficulty(DIFF_ORDER[(idx + 1) % DIFF_ORDER.length]);
    soundFX.sellCoins();
  };

  return (
    <div className="relative min-h-dvh w-full overflow-hidden flex flex-col justify-between select-none">
      {/* Live Animated Canvas Diorama Background */}
      <canvas
        ref={bgCanvasRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Subtle vignette so center UI pops crisply */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/45"
      />

      {/* Top Game Lobby Status Bar */}
      <div className="relative z-10 px-4 sm:px-6 pt-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-[#2a1d11] bg-[#2a1f16]/95 text-amber-200 text-xs font-extrabold shadow-lg">
            <Award className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <span>Commander Lv.{profile.level}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-[#2a1d11] bg-[#2a1f16]/95 text-amber-300 text-xs font-extrabold shadow-lg">
            <Coins className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <span>{profile.total_gold_earned.toLocaleString()} Coins</span>
          </div>
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-[#2a1d11] bg-[#2a1f16]/95 text-emerald-300 text-xs font-extrabold shadow-lg">
            <Trophy className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            <span>{profile.games_won} Victories</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={muted ? 'Unmute game sound' : 'Mute game sound'}
            onClick={() => {
              soundFX.muted = !muted;
              setMuted(!muted);
            }}
            className="p-2 rounded-full border-2 border-[#2a1d11] bg-[#2a1f16]/95 text-amber-200 hover:bg-[#3b2c1f] shadow-lg"
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-300" /> : <Volume2 className="w-4 h-4 text-emerald-300" />}
          </button>
          <button
            type="button"
            aria-label="Game settings"
            onClick={() => setActiveModal('menu')}
            className="p-2 rounded-full border-2 border-[#2a1d11] bg-[#2a1f16]/95 text-amber-200 hover:bg-[#3b2c1f] shadow-lg"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center Animated Crest Title + Cream Stage Card + Juicy Green Begin Button */}
      <div className="relative z-10 px-4 py-4 flex-1 flex flex-col items-center justify-center gap-5">
        {/* Shield & Ribbon Cartoon Game Logo */}
        <div className="animate-float-slow relative flex flex-col items-center text-center">
          <div className="relative px-8 py-4 rounded-3xl border-[4px] border-[#26170b] bg-gradient-to-b from-[#9c2a1b] via-[#7c1d12] to-[#56120a] shadow-[0_10px_0_#26170b,0_18px_35px_rgba(0,0,0,0.65)]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full border-2 border-[#26170b] bg-amber-400 text-[10px] font-black tracking-widest text-[#26170b] uppercase shadow">
              Idle &amp; Tactical Tower Defense
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-amber-300 game-text-outline leading-none">
              TOWER CLASH
            </h1>
            <p className="mt-1 text-xs sm:text-sm font-extrabold tracking-widest text-amber-100 uppercase game-text-outline">
              Realm Defense
            </p>
          </div>
        </div>

        {/* Parchment Stage Selector Card (Inspired by Image 3 Millbrook Card) */}
        <div className="animate-pop-in w-full max-w-md space-y-3">
          <div className="rounded-2xl border-[3px] border-[#291b10] bg-[#fdf5df] text-[#322214] p-5 shadow-[0_8px_0_#291b10,0_20px_40px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Previous stage"
                onClick={() => setStageIdx((i) => (i - 1 + GAME_MAPS.length) % GAME_MAPS.length)}
                className="p-1.5 rounded-xl border-2 border-[#291b10]/30 bg-[#f0e1be] hover:bg-[#e5cf9c] text-[#3b2816] transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="text-center">
                <p className="text-[11px] font-black tracking-widest text-[#b45309] uppercase">
                  Valley {stageIdx + 1} of {GAME_MAPS.length}
                </p>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#d97706] drop-shadow-[0_1.5px_0_#291b10]">
                  {currentMap.name}
                </h2>
              </div>

              <button
                type="button"
                aria-label="Next stage"
                onClick={() => setStageIdx((i) => (i + 1) % GAME_MAPS.length)}
                className="p-1.5 rounded-xl border-2 border-[#291b10]/30 bg-[#f0e1be] hover:bg-[#e5cf9c] text-[#3b2816] transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <p className="mt-2.5 text-center text-xs sm:text-sm font-medium text-[#4a3723] leading-relaxed">
              {currentMap.description}
            </p>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-extrabold text-[#7f1d1d]">
              <Flag className="w-3.5 h-3.5 text-rose-600 fill-rose-600" aria-hidden="true" />
              <span>Defend {currentMap.wavesCount} waves &amp; crush the Warlord!</span>
            </div>

            {/* Interactive Difficulty Pill Button */}
            <div className="mt-3.5 flex justify-center">
              <button
                type="button"
                onClick={cycleDifficulty}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl border-2 border-[#291b10] text-xs font-extrabold shadow transition-transform hover:scale-105 ${diffMeta.color}`}
              >
                <span>Difficulty: {diffMeta.label}</span>
                <span className="opacity-90 font-semibold">• {diffMeta.tag}</span>
              </button>
            </div>
          </div>

          {/* Chunky 3D Green BEGIN Button */}
          <button
            type="button"
            onClick={() => {
              soundFX.waveStart();
              onStartBattle(currentMap.id, difficulty);
            }}
            className="btn-game-green w-full py-3.5 rounded-2xl text-2xl font-black tracking-wide text-white game-text-outline flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <Play className="w-6 h-6 fill-white" aria-hidden="true" />
            <span>Begin</span>
          </button>

          {/* Compact Tip Banner */}
          <div className="rounded-xl bg-[#18120c]/80 border border-amber-500/25 px-4 py-2 text-center text-xs text-amber-100/90 backdrop-blur-xs">
            <span className="font-bold text-amber-300">Tip:</span> Click any stone plot to build towers, upgrade up to Lv.3, or unleash Meteor &amp; Frost spells!
          </div>
        </div>
      </div>

      {/* Bottom Game Dock Buttons (Tower Guide & Battle Records) */}
      <div className="relative z-10 px-4 pb-4 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setActiveModal('guide')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-[#291b10] bg-[#2c2116]/95 hover:bg-[#3d2e1f] text-amber-200 text-xs font-extrabold shadow-lg transition hover:-translate-y-0.5"
        >
          <Shield className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          <span>Towers &amp; Monsters</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveModal('records')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-[#291b10] bg-[#2c2116]/95 hover:bg-[#3d2e1f] text-amber-200 text-xs font-extrabold shadow-lg transition hover:-translate-y-0.5"
        >
          <Trophy className="w-4 h-4 text-amber-400" aria-hidden="true" />
          <span>Battle Records ({recentGames.length})</span>
        </button>
      </div>

      {/* Native Modal Dialog for Towers Guide / Battle Records / Game Menu */}
      <dialog
        ref={modalRef}
        aria-labelledby="lobby-modal-title"
        onClose={() => setActiveModal('none')}
        className="w-full max-w-2xl p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-amber-800/40 pb-3 mb-4">
          <h2 id="lobby-modal-title" className="text-lg font-black text-amber-300">
            {activeModal === 'guide' && 'Kingdom Armory — Towers'}
            {activeModal === 'records' && 'Recent Battle Victories & Logs'}
            {activeModal === 'menu' && 'Game Options'}
          </h2>
          <button
            type="button"
            onClick={() => setActiveModal('none')}
            aria-label="Close modal"
            className="p-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-amber-200"
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
                className="px-4 py-2.5 rounded-xl border border-amber-700/50 bg-[#120d08] hover:bg-[#231910] text-amber-200 font-bold text-xs flex items-center justify-center gap-2"
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
                className="px-4 py-2.5 rounded-xl border border-amber-700/50 bg-[#120d08] hover:bg-[#231910] text-cyan-300 font-bold text-xs flex items-center justify-center gap-2"
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
                className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs"
              >
                Algorithm Sandbox
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveModal('none');
                  onNavigate('performance');
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs"
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
