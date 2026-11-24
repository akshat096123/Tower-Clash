import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Bomb,
  Box,
  Coins,
  Compass,
  Crosshair,
  DollarSign,
  Flame,
  Heart,
  Home,
  Info,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Skull,
  Snowflake,
  Sparkles,
  Target,
  Timer,
  Undo2,
  Volume2,
  VolumeX,
  Waves,
  X,
  Zap,
} from 'lucide-react';
import {
  DifficultyLevel,
  GameStateSnapshot,
  GraphicsQuality,
  GridCoord,
  SortAlgorithmType,
  TargetingStrategyType,
  TowerType,
} from '../types/game';
import { GameEngine } from '../engine/GameEngine';
import { CameraViewMode, GameThreeRenderer } from '../engine/GameThreeRenderer';
import { TOWER_CATALOG } from '../engine/Tower';
import { soundFX } from '../engine/soundFx';
import type { GameHistoryRecord, PlayerProfileData } from './HomeDashboard';
import { recordMatchLocally } from '../utils/sessionStorage';

interface PlayGameProps {
  initialMapId: string;
  defaultDifficulty: DifficultyLevel;
  defaultSortAlgo: SortAlgorithmType;
  showSpatialGridDefault: boolean;
  graphicsQuality?: GraphicsQuality;
  onChangeGraphicsQuality?: (quality: GraphicsQuality) => void;
  onExitToTitle?: () => void;
  onSessionSaved: (saved?: { session: GameHistoryRecord; profile?: PlayerProfileData }) => void;
}

const TARGETING_OPTIONS: Array<{ value: TargetingStrategyType; label: string; short: string }> = [
  { value: 'first_on_path', label: 'First on Road', short: 'First' },
  { value: 'last_on_path', label: 'Last on Road', short: 'Last' },
  { value: 'nearest', label: 'Nearest', short: 'Nearest' },
  { value: 'weakest', label: 'Weakest', short: 'Weakest' },
  { value: 'strongest', label: 'Strongest', short: 'Strongest' },
  { value: 'fastest', label: 'Fastest', short: 'Fastest' },
  { value: 'highest_threat', label: 'Highest Threat', short: 'Threat' },
];

const RADIAL_OFFSETS: Array<{ x: number; y: number }> = [
  { x: -64, y: -56 },
  { x: 64, y: -56 },
  { x: 84, y: 0 },
  { x: 64, y: 56 },
  { x: -64, y: 56 },
  { x: -84, y: 0 },
];

const SHORT_TOWER_NAMES: Record<TowerType, string> = {
  basic: 'Marksman',
  sniper: 'Ranger',
  rapid: 'Gunslinger',
  splash: 'Bombardier',
  slow: 'Templar',
  laser: 'Sorceress',
};

const TOWER_ICONS: Record<TowerType, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  basic: Crosshair,
  sniper: Target,
  rapid: Zap,
  splash: Bomb,
  slow: Snowflake,
  laser: Sparkles,
};

export const PlayGame: React.FC<PlayGameProps> = ({
  initialMapId,
  defaultDifficulty,
  defaultSortAlgo,
  showSpatialGridDefault,
  graphicsQuality = 'high',
  onChangeGraphicsQuality,
  onExitToTitle,
  onSessionSaved,
}) => {
  const [placingType, setPlacingType] = useState<TowerType | null>(null);
  const [castingMeteor, setCastingMeteor] = useState(false);
  const [buildPlotCell, setBuildPlotCell] = useState<GridCoord | null>(null);
  const [hoverCell, setHoverCell] = useState<GridCoord | null>(null);
  const [muted, setMuted] = useState(soundFX.muted);
  const [localQuality, setLocalQuality] = useState<GraphicsQuality>(graphicsQuality);
  const [toastMsg, setToastMsg] = useState<string>(
    'Click any green tile to summon heroes and defend the Citadel.'
  );
  const [toastVisible, setToastVisible] = useState<boolean>(true);

  useEffect(() => {
    if (!toastMsg) return;
    setToastVisible(true);
    const timer = window.setTimeout(() => setToastVisible(false), 3200);
    return () => window.clearTimeout(timer);
  }, [toastMsg]);

  const engineRef = useRef<GameEngine>(new GameEngine(initialMapId, defaultDifficulty, defaultSortAlgo));
  const [snap, setSnap] = useState<GameStateSnapshot>(() => engineRef.current.getSnapshot());
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('isometric');
  const [stageBriefingOpen, setStageBriefingOpen] = useState(false);
  const threeRendererRef = useRef<GameThreeRenderer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const endDialogRef = useRef<HTMLDialogElement>(null);
  const savedEndRef = useRef<boolean>(false);
  const prevKillsRef = useRef<number>(0);
  const prevHpRef = useRef<number>(engineRef.current.getSnapshot().baseHealth);
  const onSessionSavedRef = useRef(onSessionSaved);
  onSessionSavedRef.current = onSessionSaved;
  const [hpFlash, setHpFlash] = useState(false);

  const resetGame = (newMapId = initialMapId, newDiff = defaultDifficulty) => {
    const sortAlgo = engineRef.current.getSnapshot().sortAlgorithm;
    const nextEngine = new GameEngine(newMapId, newDiff, sortAlgo);
    engineRef.current = nextEngine;
    threeRendererRef.current?.setMap(nextEngine.map);
    savedEndRef.current = false;
    prevKillsRef.current = 0;
    prevHpRef.current = nextEngine.getSnapshot().baseHealth;
    setHpFlash(false);
    setBuildPlotCell(null);
    setCastingMeteor(false);
    setSnap(nextEngine.getSnapshot());
    setToastMsg(`${nextEngine.map.name} ready — summon heroes anywhere on the land! Protect the Citadel.`);
  };

  useEffect(() => {
    resetGame(initialMapId, defaultDifficulty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMapId, defaultDifficulty]);

  useEffect(() => {
    soundFX.muted = muted;
  }, [muted]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const types = Object.keys(TOWER_CATALOG) as TowerType[];
      if (e.key >= '1' && e.key <= '6') {
        const chosen = types[Number(e.key) - 1];
        setPlacingType((prev) => (prev === chosen ? null : chosen));
        setCastingMeteor(false);
        setBuildPlotCell(null);
      } else if (e.key === 'Escape') {
        setPlacingType(null);
        setCastingMeteor(false);
        setBuildPlotCell(null);
        engineRef.current.selectTower(null);
        setSnap(engineRef.current.getSnapshot());
      } else if (e.key === ' ') {
        e.preventDefault();
        engineRef.current.togglePause();
        setSnap(engineRef.current.getSnapshot());
      } else if (e.key === 'Enter') {
        if (engineRef.current.skipWaveCountdown()) {
          soundFX.waveStart();
          setSnap(engineRef.current.getSnapshot());
        }
      } else if (e.key.toLowerCase() === 'z') {
        if (engineRef.current.undoLastPlacement()) {
          soundFX.sellCoins();
          setSnap(engineRef.current.getSnapshot());
        }
      } else if (e.key.toLowerCase() === 'q') {
        if ((engineRef.current.getSnapshot().meteorCooldown ?? 0) <= 0) {
          setCastingMeteor((v) => !v);
          setPlacingType(null);
          setBuildPlotCell(null);
        }
      } else if (e.key.toLowerCase() === 'e') {
        if (engineRef.current.castFrostNova()) {
          soundFX.upgradeTower();
          setSnap(engineRef.current.getSnapshot());
          setToastMsg('Frost Nova! All invaders frozen in place!');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    setLocalQuality(graphicsQuality);
  }, [graphicsQuality]);

  useEffect(() => {
    const three = threeRendererRef.current;
    if (!three) return;
    three.setGraphicsQuality(localQuality);
    const dpr = three.getRecommendedDpr();
    three.resize(Math.floor(window.innerWidth * dpr), Math.floor(window.innerHeight * dpr));
  }, [localQuality]);

  // Initialize Three.js 3D WebGL Renderer on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const three = new GameThreeRenderer(canvas);
    three.setMap(engineRef.current.map);
    three.setViewMode(cameraMode);
    three.setGraphicsQuality(localQuality);
    threeRendererRef.current = three;

    const handleResize = () => {
      const dpr = three.getRecommendedDpr();
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      three.resize(w, h);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      three.dispose();
      threeRendererRef.current = null;
    };
  }, [initialMapId]);

  // Main 60fps Game Loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let uiTimer = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      const engine = engineRef.current;
      engine.update(dt);
      const currentSnap = engine.getSnapshot();

      if (currentSnap.enemiesDefeated > prevKillsRef.current) {
        prevKillsRef.current = currentSnap.enemiesDefeated;
        soundFX.enemyCoin();
      }
      if (currentSnap.baseHealth < prevHpRef.current) {
        prevHpRef.current = currentSnap.baseHealth;
        setHpFlash(true);
        window.setTimeout(() => setHpFlash(false), 480);
      }

      // Render 3D High Quality Scene with Three.js
      const three = threeRendererRef.current;
      if (three) {
        three.render(currentSnap, dt, hoverCell, placingType);
      }

      uiTimer += dt;
      if (uiTimer >= 0.08 || currentSnap.status === 'victory' || currentSnap.status === 'defeat') {
        uiTimer = 0;
        setSnap(currentSnap);
      }

      if ((currentSnap.status === 'victory' || currentSnap.status === 'defeat') && !savedEndRef.current) {
        savedEndRef.current = true;
        if (currentSnap.status === 'victory') soundFX.victory();
        else soundFX.defeat();

        if (endDialogRef.current && !endDialogRef.current.open) {
          endDialogRef.current.showModal();
        }

        const localRecord: GameHistoryRecord = {
          id: Date.now(),
          map_name: currentSnap.mapName,
          difficulty: currentSnap.difficulty,
          victory: currentSnap.status === 'victory',
          wave_reached: currentSnap.wave,
          total_waves: currentSnap.totalWaves,
          enemies_defeated: currentSnap.enemiesDefeated,
          gold_earned: currentSnap.goldEarned,
          towers_built: currentSnap.towers.length,
          base_health_remaining: currentSnap.baseHealth,
          duration_sec: currentSnap.elapsedSec,
          targeting_algo: currentSnap.sortAlgorithm,
          created_at: new Date().toISOString(),
        };
        const localUpdated = recordMatchLocally(localRecord);
        onSessionSavedRef.current({ session: localRecord, profile: localUpdated.profile });

        fetch('/api/game-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mapId: currentSnap.mapId,
            mapName: currentSnap.mapName,
            difficulty: currentSnap.difficulty,
            victory: currentSnap.status === 'victory',
            waveReached: currentSnap.wave,
            totalWaves: currentSnap.totalWaves,
            enemiesDefeated: currentSnap.enemiesDefeated,
            goldEarned: currentSnap.goldEarned,
            towersBuilt: currentSnap.towers.length,
            baseHealthRemaining: currentSnap.baseHealth,
            durationSec: currentSnap.elapsedSec,
            targetingAlgo: currentSnap.sortAlgorithm,
            dsaMetrics: currentSnap.dsaStats,
          }),
        })
          .then(async (res) => {
            if (!res.ok) return;
            const data = (await res.json()) as {
              session?: GameHistoryRecord;
              profile?: PlayerProfileData;
            };
            if (data.session) {
              onSessionSavedRef.current({ session: data.session, profile: data.profile });
            }
          })
          .catch(() => {});
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [hoverCell, placingType, showSpatialGridDefault, buildPlotCell]);

  const getCoordsFromMouse = (e: React.MouseEvent<HTMLCanvasElement>): { cell: GridCoord; x: number; y: number } | null => {
    const three = threeRendererRef.current;
    if (three) {
      const hit = three.raycast(e.clientX, e.clientY);
      if (hit) {
        const cs = engineRef.current.map.cellSize;
        const boardW = engineRef.current.map.cols * cs;
        const boardH = engineRef.current.map.rows * cs;
        return {
          x: hit.worldX + boardW / 2,
          y: hit.worldZ + boardH / 2,
          cell: { row: hit.row, col: hit.col },
        };
      }
    }

    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = (engineRef.current.map.cols * engineRef.current.map.cellSize) / rect.width;
    const scaleY = (engineRef.current.map.rows * engineRef.current.map.cellSize) / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const cs = engineRef.current.map.cellSize;
    return {
      x,
      y,
      cell: {
        row: Math.min(engineRef.current.map.rows - 1, Math.max(0, Math.floor(y / cs))),
        col: Math.min(engineRef.current.map.cols - 1, Math.max(0, Math.floor(x / cs))),
      },
    };
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCoordsFromMouse(e);
    if (!coords) return;
    const engine = engineRef.current;

    // 0. If Meteor Strike spell is aimed, rain fire on cursor position
    if (castingMeteor) {
      if (engine.castMeteor(coords.x, coords.y)) {
        soundFX.shot(true);
        setCastingMeteor(false);
        setSnap(engine.getSnapshot());
        setToastMsg('Meteor Strike obliterated enemies in the blast zone!');
      }
      return;
    }

    const { cell } = coords;

    // 1. Clicking existing tower opens Radial Upgrade / Sell Ring
    const existing = engine.getTowerAt(cell.row, cell.col);
    if (existing) {
      setBuildPlotCell(null);
      const toggleOff = snap.selectedTowerId === existing.id;
      engine.selectTower(toggleOff ? null : existing.id);
      setSnap(engine.getSnapshot());
      setToastMsg(
        toggleOff
          ? 'Tower ring closed.'
          : `${existing.name} Lv.${existing.upgradeLevel} — Upgrade or Sell on the ring!`
      );
      return;
    }

    // 2. Quick-build mode armed
    if (placingType) {
      const res = engine.placeTower(placingType, cell.row, cell.col);
      if (res.ok) soundFX.buildTower();
      setBuildPlotCell(null);
      setSnap(engine.getSnapshot());
      setToastMsg(
        res.ok
          ? `Summoned ${SHORT_TOWER_NAMES[placingType]} (-${TOWER_CATALOG[placingType].cost} Coins)! Click hero to upgrade.`
          : res.error ?? 'Cannot place on road or obstacle!'
      );
      return;
    }

    // 3. Radial Plot Build Wheel
    engine.selectTower(null);
    if (engine.canPlaceTower(cell.row, cell.col)) {
      const samePlot = buildPlotCell && buildPlotCell.row === cell.row && buildPlotCell.col === cell.col;
      setBuildPlotCell(samePlot ? null : cell);
      setSnap(engine.getSnapshot());
      if (!samePlot) setToastMsg('Pick a hero champion on the radial wheel!');
    } else {
      setBuildPlotCell(null);
      setSnap(engine.getSnapshot());
    }
  };

  const buildFromRadial = (type: TowerType) => {
    if (!buildPlotCell) return;
    const engine = engineRef.current;
    const res = engine.placeTower(type, buildPlotCell.row, buildPlotCell.col);
    if (res.ok) {
      soundFX.buildTower();
      setBuildPlotCell(null);
      engine.selectTower(null);
      setToastMsg(`Summoned ${SHORT_TOWER_NAMES[type]} (-${TOWER_CATALOG[type].cost} Coins)!`);
    } else {
      setToastMsg(res.error ?? 'Need more Coins!');
    }
    setSnap(engine.getSnapshot());
  };

  const selectedTower = snap.towers.find((t) => t.id === snap.selectedTowerId) ?? null;
  const mapObj = engineRef.current.map;

  const getRadialAnchorStyle = (row: number, col: number): React.CSSProperties => {
    const three = threeRendererRef.current;
    if (three) {
      const proj = three.projectToScreen(row, col);
      if (proj) {
        return {
          left: `${proj.screenX}px`,
          top: `${proj.screenY}px`,
          transform: 'translate(-50%, -50%)',
        };
      }
    }
    const rawX = ((col + 0.5) / mapObj.cols) * 100;
    const rawY = ((row + 0.5) / mapObj.rows) * 100;
    return {
      left: `clamp(112px, ${rawX.toFixed(2)}%, calc(100% - 112px))`,
      top: `clamp(96px, ${rawY.toFixed(2)}%, calc(100% - 96px))`,
      transform: 'translate(-50%, -50%)',
    };
  };

  const cycleStrategy = () => {
    if (!selectedTower) return;
    const idx = TARGETING_OPTIONS.findIndex((o) => o.value === selectedTower.targetingStrategy);
    const next = TARGETING_OPTIONS[(idx + 1) % TARGETING_OPTIONS.length];
    engineRef.current.setTowerStrategy(selectedTower.id, next.value);
    setSnap(engineRef.current.getSnapshot());
    setToastMsg(`${selectedTower.name} priority -> ${next.label}`);
  };

  const autoWaveCountdown = snap.autoWaveCountdown ?? 0;
  const autoWaveEnabled = snap.autoWaveEnabled ?? true;
  const meteorCd = snap.meteorCooldown ?? 0;
  const frostCd = snap.frostCooldown ?? 0;
  const enemiesRemaining = snap.enemies.length + snap.dsaStats.spawnQueueSize;
  const hasBossActive = snap.enemies.some((e) => e.type === 'boss' || e.type === 'dragon');
  const isFinalWave = snap.wave > 0 && snap.wave >= snap.totalWaves;
  const isThreatAlert = hasBossActive || isFinalWave;
  const waveProgressPct = Math.min(100, Math.round((snap.wave / Math.max(1, snap.totalWaves)) * 100));

  return (
    <div
      className={`fixed inset-0 w-screen h-screen overflow-hidden select-none bg-[#0c140e] ${
        castingMeteor ? 'cursor-crosshair' : ''
      }`}
    >
      <h1 className="sr-only">Tower Clash Battle Arena</h1>

      {/* Full-Screen Edge-to-Edge 3D WebGL Canvas (100vw x 100vh) */}
      <canvas
        ref={canvasRef}
        onMouseMove={(e) => setHoverCell(getCoordsFromMouse(e)?.cell ?? null)}
        onMouseLeave={() => setHoverCell(null)}
        onClick={handleCanvasClick}
        aria-label={`Battlefield ${snap.mapName}`}
        className={`fixed inset-0 block w-full h-full ${
          castingMeteor ? 'cursor-crosshair' : 'cursor-pointer'
        }`}
      />

      {/* Floating Obsidian Glass In-Game HUD Layer */}
      <div className="fixed inset-0 z-20 pointer-events-none">
        {/* TOP-LEFT STAT CARD: Unified Obsidian Glass */}
        <div className="fixed top-3 left-3 flex flex-wrap items-center gap-2 max-w-[calc(100vw-24px)] 2xl:max-w-[46vw] pointer-events-auto hud-shell rounded-2xl px-2.5 py-2 text-xs font-black">
          {/* Realm Header: Home + Realm Name + Info Badge */}
          <div className="inline-flex items-center gap-1.5 pr-2 border-r border-white/10">
            {onExitToTitle && (
              <button
                type="button"
                onClick={onExitToTitle}
                aria-label="Return to Title Screen"
                title="Back to Title Screen"
                className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-white/12 bg-white/5 hover:bg-white/15 text-slate-200 transition cursor-pointer"
              >
                <Home className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setStageBriefingOpen(true)}
              className="h-9 inline-flex items-center gap-2 px-3 rounded-xl bg-white/5 hover:bg-white/12 border border-white/10 text-slate-100 cursor-pointer transition"
              title="View Stage Briefing & Objectives"
            >
              <span className="truncate max-w-[130px] sm:max-w-none tracking-tight">{snap.mapName}</span>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-amber-400/15 border border-amber-400/30">
                <Info className="w-3 h-3 text-amber-300" />
              </span>
            </button>
          </div>

          {/* Castle HP Stat */}
          <div
            className={`h-9 inline-flex items-center gap-2 px-2.5 rounded-xl bg-[#ef4444]/12 border border-[#f87171]/35 text-rose-100 tabular-nums transition ${
              hpFlash ? 'animate-hp-flash border-rose-300 bg-rose-500/25' : ''
            }`}
            title={`Citadel HP: ${snap.baseHealth} / ${snap.maxBaseHealth}`}
          >
            <span className="w-6 h-6 rounded-lg bg-[#ef4444]/20 border border-[#f87171]/40 flex items-center justify-center shrink-0">
              <Heart className="w-3.5 h-3.5 text-[#f87171] fill-[#ef4444]" aria-hidden="true" />
            </span>
            <span className="text-sm font-black tracking-tight">{snap.baseHealth}</span>
          </div>

          {/* Gold Coins Stat */}
          <div
            className="h-9 inline-flex items-center gap-2 px-2.5 rounded-xl bg-[#f59e0b]/12 border border-[#fbbf24]/35 text-amber-100 tabular-nums"
            title="Available Gold Coins"
          >
            <span className="w-6 h-6 rounded-lg bg-[#f59e0b]/20 border border-[#fbbf24]/40 flex items-center justify-center shrink-0">
              <Coins className="w-3.5 h-3.5 text-[#fbbf24]" aria-hidden="true" />
            </span>
            <span className="text-sm font-black tracking-tight text-amber-200">{snap.gold}</span>
          </div>

          {/* Wave Stat + Bottom Progress Bar */}
          <div
            className="relative overflow-hidden h-9 inline-flex items-center gap-2 px-2.5 rounded-xl bg-sky-500/12 border border-sky-400/35 text-sky-100 tabular-nums"
            title={`Wave ${snap.wave} of ${snap.totalWaves}`}
          >
            <span className="w-6 h-6 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0">
              <Waves className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
            </span>
            <span className="text-xs sm:text-sm font-black tracking-tight">
              Wave {snap.wave} / {snap.totalWaves}
            </span>
            <span
              className="absolute bottom-0 left-0 h-[3px] bg-gradient-to-r from-sky-400 via-teal-300 to-cyan-300 transition-all duration-300"
              style={{ width: `${waveProgressPct}%` }}
            />
          </div>

          {/* Enemies Remaining Stat (Boss / Final Wave Alert) */}
          <div
            className={`h-9 inline-flex items-center gap-2 px-2.5 rounded-xl border tabular-nums transition ${
              isThreatAlert
                ? 'bg-amber-500/18 border-amber-400/65 text-amber-100 shadow-[0_0_16px_rgba(245,158,11,0.28)]'
                : 'bg-emerald-500/10 border-emerald-400/30 text-emerald-100'
            }`}
            title="Enemies Remaining (Active + Spawn Queue)"
          >
            <span
              className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${
                isThreatAlert
                  ? 'bg-rose-500/25 border-amber-400/50'
                  : 'bg-emerald-500/20 border-emerald-400/35'
              }`}
            >
              <Skull
                className={`w-3.5 h-3.5 ${isThreatAlert ? 'text-amber-300 animate-pulse' : 'text-emerald-300'}`}
                aria-hidden="true"
              />
            </span>
            <span className="text-xs sm:text-sm font-black tracking-tight">{enemiesRemaining} Left</span>
            {hasBossActive && (
              <span className="px-1.5 py-0.5 rounded-md bg-rose-600/90 text-[9px] font-black tracking-wider text-white uppercase">
                Boss
              </span>
            )}
          </div>
        </div>

        {/* TOP-RIGHT CONTROLS: Clean Single-Row on 2xl+, Neatly Stepped Uniform 36px (h-9) Bars Below */}
        <div className="fixed top-3 right-3 flex flex-col 2xl:flex-row items-end 2xl:items-center gap-2 pointer-events-none">
          {/* Combat Group: Wave Status, Auto-Skip, Speed (1x/2x/3x), Pause */}
          <div className="pointer-events-auto hud-shell rounded-2xl p-1.5 flex items-center gap-1.5 tabular-nums">
            {!snap.waveActive && snap.wave < snap.totalWaves && snap.status !== 'victory' && snap.status !== 'defeat' ? (
              <button
                type="button"
                onClick={() => {
                  if (engineRef.current.skipWaveCountdown()) {
                    soundFX.waveStart();
                    setSnap(engineRef.current.getSnapshot());
                    setToastMsg(
                      snap.wave > 0 ? 'Early Wave Called! +15 Bonus Coins!' : 'Wave 1 Unleashed!'
                    );
                  }
                }}
                className="h-9 animate-pulse-beacon inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-black tracking-wide bg-gradient-to-b from-emerald-400 to-green-600 hover:from-emerald-300 hover:to-green-500 text-slate-950 border border-emerald-200 shadow cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" aria-hidden="true" />
                <span>
                  {autoWaveEnabled && autoWaveCountdown > 0
                    ? `Wave ${snap.wave + 1} (${Math.ceil(autoWaveCountdown)}s) • Skip${snap.wave > 0 ? ' +15' : ''}`
                    : `Call Wave ${snap.wave + 1}`}
                </span>
              </button>
            ) : (
              <span className="h-9 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-extrabold bg-emerald-500/15 border border-emerald-400/35 text-emerald-200">
                <Timer className="w-3.5 h-3.5 animate-spin text-emerald-300" style={{ animationDuration: '4s' }} aria-hidden="true" />
                <span>Wave {snap.wave} in Combat</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                engineRef.current.setAutoWave(!autoWaveEnabled);
                setSnap(engineRef.current.getSnapshot());
              }}
              className={`h-9 px-3 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                autoWaveEnabled
                  ? 'bg-amber-400/20 border-amber-400/70 text-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.2)]'
                  : 'bg-white/5 border-white/12 text-slate-400 hover:text-slate-200 hover:bg-white/10'
              }`}
              title="Toggle automatic wave skip countdown"
            >
              Auto-Skip: {autoWaveEnabled ? 'ON' : 'OFF'}
            </button>

            <div className="h-9 inline-flex rounded-xl border border-white/15 bg-black/25 p-0.5 gap-0.5" role="group" aria-label="Game speed">
              {([1, 2, 3] as const).map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => {
                    engineRef.current.setSpeed(spd);
                    setSnap(engineRef.current.getSnapshot());
                  }}
                  className={`px-2.5 h-full rounded-lg text-xs font-black cursor-pointer transition ${
                    snap.speedMultiplier === spd
                      ? 'bg-amber-400 text-slate-950 shadow ring-1 ring-amber-200'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={snap.status === 'idle' || snap.status === 'victory' || snap.status === 'defeat'}
              onClick={() => {
                engineRef.current.togglePause();
                setSnap(engineRef.current.getSnapshot());
              }}
              className={`h-9 w-9 inline-flex items-center justify-center rounded-xl border transition cursor-pointer disabled:opacity-40 ${
                snap.status === 'paused'
                  ? 'bg-amber-400/25 border-amber-400/70 text-amber-200'
                  : 'bg-white/5 hover:bg-white/15 border-white/12 text-slate-200'
              }`}
              aria-label={snap.status === 'paused' ? 'Resume game' : 'Pause game'}
              title="Pause / Resume (Space)"
            >
              {snap.status === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
          </div>

          {/* Utility Group: Undo, Camera, GFX, Audio, Restart */}
          <div className="pointer-events-auto hud-shell rounded-2xl p-1.5 flex items-center gap-1.5 tabular-nums">
            <button
              type="button"
              disabled={snap.dsaStats.undoStackSize === 0}
              onClick={() => {
                if (engineRef.current.undoLastPlacement()) {
                  soundFX.sellCoins();
                  setSnap(engineRef.current.getSnapshot());
                  setToastMsg('Refunded last tower placement!');
                }
              }}
              title="Undo Last Tower (Z)"
              aria-label="Undo last tower"
              className="h-9 inline-flex items-center gap-1.5 px-2.5 rounded-xl text-xs font-extrabold bg-white/5 hover:bg-white/15 disabled:opacity-40 text-amber-200 border border-white/12 cursor-pointer transition"
            >
              <Undo2 className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              <span>{snap.dsaStats.undoStackSize}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next: CameraViewMode =
                  cameraMode === 'isometric'
                    ? 'orbit'
                    : cameraMode === 'orbit'
                    ? 'topdown'
                    : 'isometric';
                setCameraMode(next);
                threeRendererRef.current?.setViewMode(next);
                setToastMsg(
                  next === 'orbit'
                    ? '3D Orbit: Click & drag mouse to rotate, wheel to zoom!'
                    : next === 'topdown'
                    ? 'Top-down Tactical Camera active'
                    : 'Isometric 3D Cinematic Camera active'
                );
              }}
              aria-label="Toggle camera view mode"
              title="Switch Camera: 3D Isometric / 3D Orbit / Top-Down"
              className="h-9 inline-flex items-center gap-1.5 px-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-amber-200 border border-white/12 text-xs font-black transition cursor-pointer"
            >
              <Box className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>
                {cameraMode === 'isometric' ? '3D Iso' : cameraMode === 'orbit' ? '3D Orbit' : '2D Top'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next: GraphicsQuality =
                  localQuality === 'high' ? 'medium' : localQuality === 'medium' ? 'low' : 'high';
                setLocalQuality(next);
                onChangeGraphicsQuality?.(next);
                setToastMsg(
                  next === 'high'
                    ? 'Graphics: High (2048px Shadows + Bloom + SMAA)'
                    : next === 'medium'
                    ? 'Graphics: Medium (1024px Shadows + SMAA)'
                    : 'Graphics: Low (Max FPS, Shadows Off)'
                );
              }}
              aria-label="Cycle graphics quality"
              title="Switch 3D Graphics Quality (Low / Medium / High)"
              className="h-9 inline-flex items-center gap-1.5 px-2.5 rounded-xl bg-cyan-500/12 hover:bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 text-xs font-black transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" aria-hidden="true" />
              <span>{localQuality === 'high' ? 'GFX: High' : localQuality === 'medium' ? 'GFX: Med' : 'GFX: Low'}</span>
            </button>

            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Unmute sound' : 'Mute sound'}
              title={muted ? 'Unmute Audio' : 'Mute Audio'}
              className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 text-slate-200 border border-white/12 cursor-pointer transition"
            >
              {muted ? <VolumeX className="w-4 h-4 text-rose-300" /> : <Volume2 className="w-4 h-4 text-emerald-300" />}
            </button>

            <button
              type="button"
              onClick={() => resetGame()}
              aria-label="Restart level"
              title="Restart Stage"
              className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 text-slate-200 border border-white/12 cursor-pointer transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Spell Aim Hint Banner */}
        {castingMeteor && (
          <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full border border-orange-300/70 bg-[rgba(40,16,8,0.8)] backdrop-blur-[10px] text-xs font-black text-orange-200 shadow-xl">
            METEOR ARMED — Click anywhere on the battlefield to strike! (Esc to cancel)
          </div>
        )}

        {/* Paused Overlay */}
        {snap.status === 'paused' && (
          <div className="pointer-events-none fixed inset-0 flex items-center justify-center bg-black/45">
            <div className="animate-pop-in px-7 py-4 rounded-2xl border border-amber-400/60 bg-[rgba(15,20,18,0.85)] backdrop-blur-[10px] text-center shadow-2xl">
              <p className="text-xl font-black tracking-widest text-amber-300">GAME PAUSED</p>
              <p className="text-xs text-amber-100 mt-1">Press Space or click Resume to continue</p>
            </div>
          </div>
        )}

        {/* Radial Upgrade & Sell Ring around Selected Tower */}
        {selectedTower && (
          <div
            style={getRadialAnchorStyle(selectedTower.row, selectedTower.col)}
            className="animate-radial-pop fixed z-30 pointer-events-none"
          >
            <div className="relative w-40 h-40 rounded-full border-[3px] border-[#3d2914] ring-2 ring-amber-400/60 bg-black/15 backdrop-blur-[2px]">
              {/* TOP: Green Up-Arrow Upgrade + Coin Price */}
              <button
                type="button"
                disabled={selectedTower.upgradeCost === 0 || snap.gold < selectedTower.upgradeCost}
                onClick={(e) => {
                  e.stopPropagation();
                  if (engineRef.current.upgradeTower(selectedTower.id)) {
                    soundFX.upgradeTower();
                    setSnap(engineRef.current.getSnapshot());
                    setToastMsg(`Upgraded ${selectedTower.name} to Lv.${selectedTower.level + 1}!`);
                  }
                }}
                className="pointer-events-auto absolute -top-5 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center w-14 h-14 rounded-xl border-2 border-amber-300 bg-gradient-to-b from-emerald-500 to-green-800 hover:from-emerald-400 hover:to-green-700 disabled:grayscale disabled:opacity-65 text-white shadow-xl transition-transform hover:scale-110 cursor-pointer"
                title={
                  selectedTower.upgradeCost === 0
                    ? 'Maximum Level Reached'
                    : `Upgrade Tower (${selectedTower.upgradeCost} Coins)`
                }
              >
                <ArrowUp className="w-6 h-6 stroke-[3] text-lime-200" aria-hidden="true" />
                <span className="px-1.5 rounded bg-black/80 text-[10px] font-extrabold text-amber-300 border border-amber-500/40">
                  {selectedTower.upgradeCost === 0 ? 'MAX' : `${selectedTower.upgradeCost}`}
                </span>
              </button>

              {/* BOTTOM: Golden $ Sell Coin Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  engineRef.current.sellTower(selectedTower.id);
                  soundFX.sellCoins();
                  setSnap(engineRef.current.getSnapshot());
                  setToastMsg(`Sold ${selectedTower.name} for +${selectedTower.sellValue} Coins!`);
                }}
                className="pointer-events-auto absolute -bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center w-14 h-14 rounded-xl border-2 border-amber-300 bg-gradient-to-b from-amber-700 to-amber-950 hover:from-amber-600 hover:to-amber-900 text-amber-200 shadow-xl transition-transform hover:scale-110 cursor-pointer"
                title={`Sell for +${selectedTower.sellValue} Coins`}
              >
                <DollarSign className="w-5 h-5 stroke-[2.8] text-amber-300" aria-hidden="true" />
                <span className="px-1.5 rounded bg-black/80 text-[10px] font-extrabold text-amber-300 border border-amber-500/40">
                  +{selectedTower.sellValue}
                </span>
              </button>

              {/* LEFT: Targeting Cycler */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cycleStrategy();
                }}
                className="pointer-events-auto absolute top-1/2 -left-11 -translate-y-1/2 flex flex-col items-center justify-center px-2 py-1.5 rounded-lg border-2 border-sky-300/80 bg-[#0f2336]/90 hover:bg-[#16344f] text-sky-100 shadow-lg text-[10px] font-extrabold cursor-pointer"
                title="Cycle Target Priority"
              >
                <Crosshair className="w-3.5 h-3.5 text-sky-300 mb-0.5" aria-hidden="true" />
                <span>
                  {TARGETING_OPTIONS.find((o) => o.value === selectedTower.targetingStrategy)?.short ?? 'First'}
                </span>
              </button>

              {/* RIGHT: Stats + Close */}
              <div className="pointer-events-auto absolute top-1/2 -right-14 -translate-y-1/2 flex items-center gap-1 px-2 py-1.5 rounded-lg border-2 border-amber-400/70 bg-[#1a130d]/95 text-[10px] font-bold text-amber-100 shadow-lg">
                <div className="leading-tight">
                  <div className="text-amber-300">Lv.{selectedTower.level}</div>
                  <div>{selectedTower.damage} DMG</div>
                </div>
                <button
                  type="button"
                  aria-label="Close ring"
                  onClick={(e) => {
                    e.stopPropagation();
                    engineRef.current.selectTower(null);
                    setSnap(engineRef.current.getSnapshot());
                  }}
                  className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Radial 6-Tower Build Wheel on Empty Plot */}
        {buildPlotCell && !selectedTower && (
          <div
            style={getRadialAnchorStyle(buildPlotCell.row, buildPlotCell.col)}
            className="animate-radial-pop fixed z-30 pointer-events-none"
          >
            <div className="relative w-36 h-36 rounded-full border-[3px] border-amber-400/70 bg-black/20 backdrop-blur-[2px]">
              {(Object.keys(TOWER_CATALOG) as TowerType[]).map((type, idx) => {
                const cfg = TOWER_CATALOG[type];
                const pos = RADIAL_OFFSETS[idx];
                const affordable = snap.gold >= cfg.cost;
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={!affordable}
                    onClick={(e) => {
                      e.stopPropagation();
                      buildFromRadial(type);
                    }}
                    style={{
                      transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
                    }}
                    className="pointer-events-auto absolute left-1/2 top-1/2 w-14 py-1 rounded-xl border-2 border-amber-300 bg-[#1e160f]/95 hover:bg-[#2d2116] disabled:opacity-45 text-center shadow-xl transition-transform hover:scale-110 cursor-pointer"
                    title={`${cfg.name} (${cfg.cost} Coins)`}
                  >
                    <span
                      className="mx-auto block w-3.5 h-3.5 rounded-full border border-black"
                      style={{ backgroundColor: cfg.color }}
                    />
                    <span className="block text-[10px] font-extrabold text-amber-100 leading-tight mt-0.5">
                      {SHORT_TOWER_NAMES[type]}
                    </span>
                    <span className="block text-[9px] font-extrabold text-amber-300 bg-black/75 rounded mx-1">
                      {cfg.cost}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                aria-label="Cancel build wheel"
                onClick={(e) => {
                  e.stopPropagation();
                  setBuildPlotCell(null);
                }}
                className="pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-rose-900/90 border border-rose-400 text-rose-100 flex items-center justify-center shadow-md hover:bg-rose-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Auto-fading Compact Status Toast */}
        {toastVisible && toastMsg && (
          <div className="pointer-events-none fixed bottom-16 left-1/2 -translate-x-1/2 z-20 max-w-[90vw]">
            <p
              className="px-3 py-1 rounded-full border border-white/15 bg-[rgba(15,20,18,0.72)] backdrop-blur-[10px] text-[11px] font-semibold text-amber-200/95 shadow-lg truncate"
              aria-live="polite"
            >
              {toastMsg}
            </p>
          </div>
        )}

        {/* BOTTOM-CENTER DOCK: Sculpted Dark-Glass Unit Cards (18px radius) */}
        <div className="fixed bottom-2.5 left-1/2 -translate-x-1/2 max-w-[calc(100vw-24px)] lg:max-w-[calc(100vw-300px)] pointer-events-auto">
          <div className="hud-shell rounded-[18px] px-2.5 py-2 flex items-stretch gap-2 overflow-x-auto tabular-nums">
            <button
              type="button"
              onClick={() => {
                setPlacingType(null);
                setCastingMeteor(false);
              }}
              title="Click any buildable green tile to open the radial summon wheel [Esc]"
              className={`shrink-0 px-3 py-1.5 rounded-xl border transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                placingType === null && !castingMeteor
                  ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-slate-950 border-amber-200 shadow-[0_0_14px_rgba(251,191,36,0.35)]'
                  : 'bg-white/5 text-amber-200 border-white/12 hover:bg-white/10'
              }`}
            >
              <Compass className="w-4 h-4" aria-hidden="true" />
              <span className="text-[10px] font-black tracking-wide uppercase">Wheel</span>
            </button>

            {(Object.keys(TOWER_CATALOG) as TowerType[]).map((type, idx) => {
              const t = TOWER_CATALOG[type];
              const active = placingType === type;
              const affordable = snap.gold >= t.cost;
              const Icon = TOWER_ICONS[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setBuildPlotCell(null);
                    setCastingMeteor(false);
                    setPlacingType(active ? null : type);
                  }}
                  className={`relative shrink-0 min-w-[104px] px-2.5 py-1.5 rounded-xl border transition flex items-center gap-2 cursor-pointer ${
                    active
                      ? 'bg-emerald-500/25 border-emerald-400 text-emerald-50 shadow-[0_0_18px_rgba(52,211,153,0.35)] -translate-y-0.5'
                      : affordable
                      ? 'bg-white/[0.06] border-white/15 text-slate-100 hover:border-amber-400/70 hover:bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                      : 'bg-black/35 border-white/10 text-slate-400 opacity-[0.48]'
                  }`}
                  title={`${t.name} [Key ${idx + 1}] — DMG ${t.damage} • RNG ${t.range} • ${t.specialAbility}`}
                >
                  {/* Hotkey Pill */}
                  <span className="absolute -top-1 -right-1 px-1.5 py-0 rounded-md bg-slate-950/95 border border-white/20 text-[9px] font-black text-slate-200 leading-tight tabular-nums">
                    {idx + 1}
                  </span>

                  {/* Colored Icon Badge */}
                  <span
                    className="shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center shadow-inner"
                    style={{
                      backgroundColor: `${t.color}24`,
                      borderColor: active ? '#34d399' : `${t.color}88`,
                    }}
                  >
                    {affordable ? (
                      <Icon className="w-3.5 h-3.5" style={{ color: t.color }} aria-hidden="true" />
                    ) : (
                      <Lock className="w-3 h-3 text-slate-400" aria-hidden="true" />
                    )}
                  </span>

                  <div className="flex flex-col items-start leading-tight">
                    <span className="text-[11px] font-extrabold tracking-tight">{SHORT_TOWER_NAMES[type]}</span>
                    <span
                      className={`inline-flex items-center gap-0.5 text-[10px] font-black tabular-nums ${
                        affordable ? 'text-amber-300' : 'text-rose-300/85'
                      }`}
                    >
                      <Coins className="w-2.5 h-2.5" aria-hidden="true" />
                      {t.cost}
                    </span>
                  </div>
                </button>
              );
            })}

            {/* Inline spells on narrow screens (< lg) */}
            <div className="flex lg:hidden items-center gap-1.5 pl-2 border-l border-white/12 shrink-0">
              <button
                type="button"
                disabled={meteorCd > 0}
                onClick={() => {
                  setPlacingType(null);
                  setBuildPlotCell(null);
                  setCastingMeteor((v) => !v);
                }}
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-black inline-flex items-center gap-1 transition cursor-pointer tabular-nums ${
                  castingMeteor
                    ? 'border-yellow-300 bg-orange-600 text-white shadow-lg shadow-orange-500/40'
                    : meteorCd > 0
                    ? 'border-white/10 bg-black/45 text-slate-400'
                    : 'border-orange-400/80 bg-gradient-to-b from-orange-500 to-red-700 text-white'
                }`}
                title="Meteor Strike AoE [Q]"
              >
                <Flame className="w-3.5 h-3.5 text-yellow-200" aria-hidden="true" />
                <span>{meteorCd > 0 ? `${Math.ceil(meteorCd)}s` : 'Q'}</span>
              </button>

              <button
                type="button"
                disabled={frostCd > 0}
                onClick={() => {
                  if (engineRef.current.castFrostNova()) {
                    soundFX.upgradeTower();
                    setSnap(engineRef.current.getSnapshot());
                    setToastMsg('Frost Nova chilled all enemies across the realm!');
                  }
                }}
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-black inline-flex items-center gap-1 transition cursor-pointer tabular-nums ${
                  frostCd > 0
                    ? 'border-white/10 bg-black/45 text-slate-400'
                    : 'border-sky-300/80 bg-gradient-to-b from-sky-500 to-blue-800 text-white'
                }`}
                title="Frost Nova [E]"
              >
                <Snowflake className="w-3.5 h-3.5 text-sky-100" aria-hidden="true" />
                <span>{frostCd > 0 ? `${Math.ceil(frostCd)}s` : 'E'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* BOTTOM-RIGHT SPELL PILL (Desktop >= lg): Vibrant Tactile Spell Triggers */}
        <div className="hidden lg:flex fixed bottom-2.5 right-3 pointer-events-auto hud-shell rounded-[18px] p-2 items-center gap-2 tabular-nums">
          <button
            type="button"
            disabled={meteorCd > 0}
            onClick={() => {
              setPlacingType(null);
              setBuildPlotCell(null);
              setCastingMeteor((v) => !v);
            }}
            className={`h-10 px-3.5 rounded-xl border text-xs font-black inline-flex items-center gap-2 transition cursor-pointer ${
              castingMeteor
                ? 'border-yellow-200 bg-orange-600 text-white shadow-[0_0_20px_rgba(249,115,22,0.65)] scale-105'
                : meteorCd > 0
                ? 'border-white/10 bg-black/50 text-slate-400 cursor-not-allowed'
                : 'border-orange-300/80 bg-gradient-to-b from-orange-500 to-red-700 text-white hover:brightness-110 shadow-[0_4px_14px_rgba(239,68,68,0.4)]'
            }`}
            title="Meteor Strike AoE [Q] — Click button then click anywhere on the battlefield"
          >
            <Flame className="w-4 h-4 text-yellow-200" aria-hidden="true" />
            <span>{meteorCd > 0 ? `Meteor ${Math.ceil(meteorCd)}s` : 'Meteor [Q]'}</span>
          </button>

          <button
            type="button"
            disabled={frostCd > 0}
            onClick={() => {
              if (engineRef.current.castFrostNova()) {
                soundFX.upgradeTower();
                setSnap(engineRef.current.getSnapshot());
                setToastMsg('Frost Nova chilled all enemies across the realm!');
              }
            }}
            className={`h-10 px-3.5 rounded-xl border text-xs font-black inline-flex items-center gap-2 transition cursor-pointer ${
              frostCd > 0
                ? 'border-white/10 bg-black/50 text-slate-400 cursor-not-allowed'
                : 'border-sky-300/85 bg-gradient-to-b from-sky-500 to-blue-800 text-white hover:brightness-110 shadow-[0_4px_14px_rgba(56,189,248,0.4)]'
            }`}
            title="Frost Nova [E] — Freeze & slow every invader on the battlefield"
          >
            <Snowflake className="w-4 h-4 text-sky-100" aria-hidden="true" />
            <span>{frostCd > 0 ? `Frost ${Math.ceil(frostCd)}s` : 'Frost [E]'}</span>
          </button>
        </div>
      </div>

      {/* Victory / Defeat Celebration Modal */}
      <dialog ref={endDialogRef} aria-labelledby="end-game-title" className="w-full max-w-md p-6">
        <div className="space-y-4">
          <h1
            id="end-game-title"
            className={`text-2xl font-black ${
              snap.status === 'victory' ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {snap.status === 'victory' ? 'Kingdom Defended! Victory!' : 'Castle Breached — Defeat'}
          </h1>
          <p className="text-sm text-stone-300">
            {snap.status === 'victory'
              ? `You repelled every raid across ${snap.mapName} through Wave ${snap.totalWaves}!`
              : `The invaders broke through on Wave ${snap.wave} of ${snap.totalWaves}.`}
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-black/40 border border-amber-900/50 p-3">
              <p className="text-stone-400">Enemies Slain</p>
              <p className="text-lg font-black text-white">{snap.enemiesDefeated}</p>
            </div>
            <div className="rounded-xl bg-black/40 border border-amber-900/50 p-3">
              <p className="text-stone-400">Coins Looted</p>
              <p className="text-lg font-black text-amber-300">{snap.goldEarned} Coins</p>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            {onExitToTitle && (
              <button
                type="button"
                onClick={() => {
                  endDialogRef.current?.close();
                  onExitToTitle();
                }}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-[#2b2017] hover:bg-[#3a2b20] text-amber-100 border border-amber-700/60"
              >
                Title Screen
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                endDialogRef.current?.close();
                resetGame();
              }}
              className="btn-game-green px-5 py-2 rounded-xl text-sm font-black text-white game-text-outline"
            >
              Play Again
            </button>
          </div>
        </div>
      </dialog>

      {/* Millbrook-Style Stage Briefing Modal (Matching User Image 5) */}
      {stageBriefingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="animate-pop-in relative w-full max-w-md rounded-2xl border-[3px] border-[#291b10] bg-[#fdf5df] text-[#322214] p-6 shadow-[0_8px_0_#291b10,0_20px_40px_rgba(0,0,0,0.8)]">
            <button
              type="button"
              onClick={() => setStageBriefingOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-[#322214]/60 hover:text-[#322214]"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <p className="text-[11px] font-black tracking-widest text-[#b45309] uppercase">
                {mapObj.subtitle || `Valley 1 of 4`}
              </p>
              <h2 className="text-3xl font-black tracking-tight text-[#d97706] drop-shadow-[0_1.5px_0_#291b10]">
                {mapObj.name}
              </h2>
            </div>

            <p className="mt-3 text-center text-xs sm:text-sm font-medium text-[#4a3723] leading-relaxed">
              {mapObj.description}
            </p>

            <div className="mt-4 rounded-xl border border-amber-700/20 bg-[#f4e6c3] p-3 text-center text-xs font-bold text-[#7f1d1d]">
              Defend {mapObj.wavesCount} waves and eliminate the Kernel Overlord!
            </div>

            <div className="mt-4 flex justify-center">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl border-2 border-[#291b10] text-xs font-black bg-[#2c8a3e] text-white shadow">
                Difficulty: {snap.difficulty.toUpperCase()} • Coins: {snap.gold}
              </span>
            </div>

            {/* Chunky Green Begin Button */}
            <button
              type="button"
              onClick={() => {
                setStageBriefingOpen(false);
                if (snap.status === 'idle') {
                  engineRef.current.skipWaveCountdown();
                  setSnap(engineRef.current.getSnapshot());
                }
              }}
              className="btn-game-green mt-5 w-full py-3.5 rounded-2xl text-xl font-black tracking-wide text-white game-text-outline flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <Play className="w-5 h-5 fill-white" aria-hidden="true" />
              <span>Begin Battle</span>
            </button>

            <div className="mt-3 rounded-xl bg-[#26170c] border border-amber-500/30 px-3 py-2 text-center text-[11px] text-amber-200">
              <span className="font-bold text-amber-400">Tip:</span> Switch to 3D Orbit Camera to view the battlefield from any angle!
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
