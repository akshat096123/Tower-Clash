import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Box,
  Coins,
  Compass,
  Crosshair,
  DollarSign,
  Eye,
  Flame,
  Heart,
  Home,
  Info,
  Pause,
  Play,
  RotateCcw,
  Skull,
  Snowflake,
  Sparkles,
  Timer,
  Undo2,
  Volume2,
  VolumeX,
  Waves,
  X,
} from 'lucide-react';
import {
  DifficultyLevel,
  GameStateSnapshot,
  GridCoord,
  SortAlgorithmType,
  TargetingStrategyType,
  TowerType,
} from '../types/game';
import { GameEngine } from '../engine/GameEngine';
import { renderGameCanvas } from '../engine/GameCanvasRenderer';
import { CameraViewMode, GameThreeRenderer } from '../engine/GameThreeRenderer';
import { TOWER_CATALOG } from '../engine/Tower';
import { soundFX } from '../engine/soundFx';

interface PlayGameProps {
  initialMapId: string;
  defaultDifficulty: DifficultyLevel;
  defaultSortAlgo: SortAlgorithmType;
  showSpatialGridDefault: boolean;
  onExitToTitle?: () => void;
  onSessionSaved: () => void;
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

export const PlayGame: React.FC<PlayGameProps> = ({
  initialMapId,
  defaultDifficulty,
  defaultSortAlgo,
  showSpatialGridDefault,
  onExitToTitle,
  onSessionSaved,
}) => {
  const [placingType, setPlacingType] = useState<TowerType | null>(null);
  const [castingMeteor, setCastingMeteor] = useState(false);
  const [buildPlotCell, setBuildPlotCell] = useState<GridCoord | null>(null);
  const [hoverCell, setHoverCell] = useState<GridCoord | null>(null);
  const [muted, setMuted] = useState(soundFX.muted);
  const [toastMsg, setToastMsg] = useState<string>(
    'Click anywhere on the land to summon heroes! Protect the Royal Citadel!'
  );

  const engineRef = useRef<GameEngine>(new GameEngine(initialMapId, defaultDifficulty, defaultSortAlgo));
  const [snap, setSnap] = useState<GameStateSnapshot>(() => engineRef.current.getSnapshot());
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('isometric');
  const [stageBriefingOpen, setStageBriefingOpen] = useState(false);
  const threeRendererRef = useRef<GameThreeRenderer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const endDialogRef = useRef<HTMLDialogElement>(null);
  const savedEndRef = useRef<boolean>(false);
  const prevKillsRef = useRef<number>(0);

  const resetGame = (newMapId = initialMapId, newDiff = defaultDifficulty) => {
    const sortAlgo = engineRef.current.getSnapshot().sortAlgorithm;
    const nextEngine = new GameEngine(newMapId, newDiff, sortAlgo);
    engineRef.current = nextEngine;
    threeRendererRef.current?.setMap(nextEngine.map);
    savedEndRef.current = false;
    prevKillsRef.current = 0;
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

  // Initialize Three.js 3D WebGL Renderer on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const three = new GameThreeRenderer(canvas);
    three.setMap(engineRef.current.map);
    three.setViewMode(cameraMode);
    threeRendererRef.current = three;

    const handleResize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(rect.width * dpr);
      const h = Math.floor(rect.height * dpr);
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
          .then(() => onSessionSaved())
          .catch(() => {});
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [hoverCell, placingType, showSpatialGridDefault, buildPlotCell, onSessionSaved]);

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

  return (
    <div className="min-h-dvh w-full bg-[#0d180b] px-2 sm:px-4 py-2 flex flex-col justify-between gap-2 select-none">
      {/* Top Floating Game HUD Bar (Pure Game — Zero Website Tabs!) */}
      <div className="max-w-[1260px] w-full mx-auto rounded-2xl border-2 border-[#3b2916] bg-gradient-to-b from-[#2b1f15] via-[#21170f] to-[#17100a] px-3 py-2 shadow-xl shadow-black/60 flex flex-wrap items-center justify-between gap-2">
        {/* Left: Home + Vitals (Lives, Coins, Wave, Kills) */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-black">
          <h1 className="sr-only">Tower Clash Battle Arena</h1>
          {onExitToTitle && (
            <button
              type="button"
              onClick={onExitToTitle}
              aria-label="Return to Title Screen"
              title="Back to Title Screen"
              className="p-1.5 rounded-lg border-2 border-[#4d3720] bg-[#140e09] hover:bg-[#332417] text-amber-200 transition"
            >
              <Home className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setStageBriefingOpen(true)}
            className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/60 border border-amber-700/40 text-amber-200 cursor-pointer transition hover:text-white"
            title="View Stage Story & Objectives"
          >
            <span>{snap.mapName}</span>
            <Info className="w-3.5 h-3.5 text-amber-400" />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#381418] border border-rose-500/60 text-rose-100 shadow-inner">
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500" aria-hidden="true" />
            <span>{snap.baseHealth}</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#34270a] border border-amber-400/75 text-amber-200 shadow-inner">
            <Coins className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <span>{snap.gold} Coins</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#122634] border border-sky-400/50 text-sky-100">
            <Waves className="w-4 h-4 text-sky-400" aria-hidden="true" />
            <span>
              Wave {snap.wave}/{snap.totalWaves}
            </span>
          </div>

          <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#142b19] border border-emerald-500/40 text-emerald-200">
            <Skull className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            <span>{snap.enemiesDefeated}</span>
          </div>
        </div>

        {/* Center: Auto-Wave Timer & Skip-Wave Bonus Button */}
        <div className="flex flex-wrap items-center gap-1.5">
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
              className="animate-pulse-beacon inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black tracking-wide bg-gradient-to-b from-emerald-400 to-green-600 hover:from-emerald-300 hover:to-green-500 text-slate-950 border-2 border-emerald-200 shadow-lg cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-slate-950" aria-hidden="true" />
              <span>
                {autoWaveEnabled && autoWaveCountdown > 0
                  ? `Wave ${snap.wave + 1} in ${Math.ceil(autoWaveCountdown)}s • Skip${snap.wave > 0 ? ' (+15 Coins)' : ''}`
                  : `Call Wave ${snap.wave + 1}`}
              </span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-[#1c2b18] border border-emerald-500/40 text-emerald-300">
              <Timer className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} aria-hidden="true" />
              <span>Wave {snap.wave} in Combat</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              engineRef.current.setAutoWave(!autoWaveEnabled);
              setSnap(engineRef.current.getSnapshot());
            }}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold border transition ${
              autoWaveEnabled
                ? 'bg-amber-400/20 border-amber-400 text-amber-200'
                : 'bg-[#17110b] border-stone-700 text-stone-400'
            }`}
            title="Toggle automatic wave skip countdown"
          >
            Auto-Skip: {autoWaveEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Right: Speed, Pause, Undo, Sound, Restart */}
        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-lg border border-amber-700/50 overflow-hidden" role="group" aria-label="Game speed">
            {([1, 2, 3] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => {
                  engineRef.current.setSpeed(spd);
                  setSnap(engineRef.current.getSnapshot());
                }}
                className={`px-2 py-1.5 text-xs font-extrabold ${
                  snap.speedMultiplier === spd ? 'bg-amber-400 text-slate-950' : 'bg-[#16100b] text-amber-200 hover:bg-[#2a1f16]'
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
            className="p-1.5 rounded-lg bg-[#2b2017] hover:bg-[#3a2b20] disabled:opacity-40 text-amber-100 border border-amber-700/50"
            aria-label={snap.status === 'paused' ? 'Resume game' : 'Pause game'}
            title="Pause / Resume (Space)"
          >
            {snap.status === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>

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
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-[#2b2017] hover:bg-[#3a2b20] disabled:opacity-40 text-amber-300 border border-amber-700/50"
          >
            <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
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
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2b2017] hover:bg-[#3a2b20] text-amber-300 border border-amber-700/50 text-xs font-black shadow transition"
          >
            <Box className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <span>
              {cameraMode === 'isometric' ? '3D Iso' : cameraMode === 'orbit' ? '3D Orbit' : '2D Top'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            className="p-1.5 rounded-lg bg-[#2b2017] hover:bg-[#3a2b20] text-amber-200 border border-amber-700/50"
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-300" /> : <Volume2 className="w-4 h-4 text-emerald-300" />}
          </button>

          <button
            type="button"
            onClick={() => resetGame()}
            aria-label="Restart level"
            title="Restart Stage"
            className="p-1.5 rounded-lg bg-[#2b2017] hover:bg-[#3a2b20] text-amber-200 border border-amber-700/50"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Centered Battlefield Canvas */}
      <div className="max-w-[1260px] w-full mx-auto flex-1 flex items-center justify-center">
        <div
          className={`relative w-full max-w-[1160px] rounded-2xl border-4 border-[#3a2a19] bg-[#16270e] p-1 shadow-2xl shadow-black/75 ${
            castingMeteor ? 'cursor-crosshair ring-4 ring-orange-500/70' : ''
          }`}
        >
          <canvas
            ref={canvasRef}
            width={mapObj.cols * mapObj.cellSize}
            height={mapObj.rows * mapObj.cellSize}
            onMouseMove={(e) => setHoverCell(getCoordsFromMouse(e)?.cell ?? null)}
            onMouseLeave={() => setHoverCell(null)}
            onClick={handleCanvasClick}
            aria-label={`Battlefield ${snap.mapName}`}
            className="w-full h-auto rounded-xl cursor-pointer"
          />

          {/* Spell Aim Hint Banner */}
          {castingMeteor && (
            <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full border-2 border-orange-300 bg-orange-950/90 text-xs font-black text-orange-200 shadow-xl">
              METEOR ARMED — Click anywhere on the battlefield to strike! (Esc to cancel)
            </div>
          )}

          {/* Paused Overlay */}
          {snap.status === 'paused' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
              <div className="animate-pop-in px-7 py-4 rounded-2xl border-2 border-amber-400 bg-[#1c140c]/95 text-center shadow-2xl">
                <p className="text-xl font-black tracking-widest text-amber-300">GAME PAUSED</p>
                <p className="text-xs text-amber-100 mt-1">Press Space or click Resume to continue</p>
              </div>
            </div>
          )}

          {/* Kingdom Rush Style Radial Upgrade & Sell Ring around Selected Tower */}
          {selectedTower && (
            <div
              style={getRadialAnchorStyle(selectedTower.row, selectedTower.col)}
              className="animate-radial-pop absolute z-20 pointer-events-none"
            >
              <div className="relative w-40 h-40 rounded-full border-[3px] border-[#3d2914] ring-2 ring-amber-400/60 bg-black/10">
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
                  className="pointer-events-auto absolute -top-5 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center w-14 h-14 rounded-xl border-2 border-amber-300 bg-gradient-to-b from-emerald-500 to-green-800 hover:from-emerald-400 hover:to-green-700 disabled:grayscale disabled:opacity-65 text-white shadow-xl transition-transform hover:scale-110"
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
                  className="pointer-events-auto absolute -bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center w-14 h-14 rounded-xl border-2 border-amber-300 bg-gradient-to-b from-amber-700 to-amber-950 hover:from-amber-600 hover:to-amber-900 text-amber-200 shadow-xl transition-transform hover:scale-110"
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
                  className="pointer-events-auto absolute top-1/2 -left-11 -translate-y-1/2 flex flex-col items-center justify-center px-2 py-1.5 rounded-lg border-2 border-sky-300/80 bg-[#0f2336] hover:bg-[#16344f] text-sky-100 shadow-lg text-[10px] font-extrabold"
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
                    className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Kingdom Rush Style Radial 6-Tower Build Wheel on Empty Plot */}
          {buildPlotCell && !selectedTower && (
            <div
              style={getRadialAnchorStyle(buildPlotCell.row, buildPlotCell.col)}
              className="animate-radial-pop absolute z-20 pointer-events-none"
            >
              <div className="relative w-36 h-36 rounded-full border-[3px] border-amber-400/70 bg-black/20">
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
                      className="pointer-events-auto absolute left-1/2 top-1/2 w-14 py-1 rounded-xl border-2 border-amber-300 bg-[#1e160f]/95 hover:bg-[#2d2116] disabled:opacity-45 text-center shadow-xl transition-transform hover:scale-110"
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
                  className="pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-rose-900/90 border border-rose-400 text-rose-100 flex items-center justify-center shadow-md hover:bg-rose-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Game Action Dock: Hero Champions + Mage Spells */}
      <div className="max-w-[1260px] w-full mx-auto rounded-2xl border-2 border-[#3b2916] bg-gradient-to-b from-[#231910] to-[#130d08] px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xl">
        {/* Quick Hero Deck */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setPlacingType(null);
              setCastingMeteor(false);
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold border transition ${
              placingType === null && !castingMeteor
                ? 'bg-amber-400 text-slate-950 border-amber-200 shadow'
                : 'bg-[#2a2017] text-amber-200 border-amber-800 hover:bg-[#36291e]'
            }`}
          >
            Summon Wheel
          </button>

          {(Object.keys(TOWER_CATALOG) as TowerType[]).map((type, idx) => {
            const t = TOWER_CATALOG[type];
            const active = placingType === type;
            const affordable = snap.gold >= t.cost;
            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setBuildPlotCell(null);
                  setCastingMeteor(false);
                  setPlacingType(active ? null : type);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ${
                  active
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100 shadow-inner scale-105'
                    : 'bg-[#17110c] border-amber-900/70 text-amber-100 hover:border-amber-500'
                } ${!affordable ? 'opacity-50' : ''}`}
                title={`${t.name} [Key ${idx + 1}]`}
              >
                <span className="w-2.5 h-2.5 rounded-full border border-black" style={{ backgroundColor: t.color }} />
                <span>{SHORT_TOWER_NAMES[type]}</span>
                <span className="inline-flex items-center gap-0.5 text-amber-300 font-extrabold">
                  <Coins className="w-3 h-3" aria-hidden="true" />
                  {t.cost}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status Toast */}
        <p className="hidden xl:block text-xs font-semibold text-amber-200/90" aria-live="polite">
          {toastMsg}
        </p>

        {/* Active Mage Spell Abilities (Meteor Strike & Frost Nova) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={meteorCd > 0}
            onClick={() => {
              setPlacingType(null);
              setBuildPlotCell(null);
              setCastingMeteor((v) => !v);
            }}
            className={`px-3 py-1.5 rounded-xl border-2 text-xs font-black inline-flex items-center gap-1.5 transition ${
              castingMeteor
                ? 'border-yellow-300 bg-orange-600 text-white shadow-lg shadow-orange-500/40 scale-105'
                : meteorCd > 0
                ? 'border-stone-700 bg-stone-900 text-stone-400'
                : 'border-orange-400 bg-gradient-to-b from-orange-500 to-red-700 text-white hover:brightness-110 shadow-md'
            }`}
            title="Meteor Strike AoE [Q] — Click button then click anywhere on the battlefield"
          >
            <Flame className="w-4 h-4 text-yellow-200" aria-hidden="true" />
            <span>{meteorCd > 0 ? `${Math.ceil(meteorCd)}s` : 'Meteor [Q]'}</span>
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
            className={`px-3 py-1.5 rounded-xl border-2 text-xs font-black inline-flex items-center gap-1.5 transition ${
              frostCd > 0
                ? 'border-stone-700 bg-stone-900 text-stone-400'
                : 'border-sky-300 bg-gradient-to-b from-sky-500 to-blue-800 text-white hover:brightness-110 shadow-md'
            }`}
            title="Frost Nova [E] — Freeze & slow every invader on the battlefield"
          >
            <Snowflake className="w-4 h-4 text-sky-100" aria-hidden="true" />
            <span>{frostCd > 0 ? `${Math.ceil(frostCd)}s` : 'Frost [E]'}</span>
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
