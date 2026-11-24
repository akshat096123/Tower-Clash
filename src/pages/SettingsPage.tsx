import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, RotateCcw, Save, Trash2 } from 'lucide-react';
import { DifficultyLevel, GraphicsQuality, SortAlgorithmType } from '../types/game';
import { SORT_LABELS } from '../dsa/sorting';

export interface AppSettings {
  defaultDifficulty: DifficultyLevel;
  defaultSortAlgo: SortAlgorithmType;
  benchmarkEngine: 'cpp' | 'ts';
  reducedMotion: boolean;
  showSpatialGrid: boolean;
  graphicsQuality: GraphicsQuality;
}

interface SettingsPageProps {
  settings: AppSettings;
  onSaveSettings: (next: AppSettings) => Promise<void>;
  onResetAllData: () => Promise<void>;
  onOpenDiagrams: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onSaveSettings,
  onResetAllData,
  onOpenDiagrams,
}) => {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [savedNotice, setSavedNotice] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    const dlg = confirmDialogRef.current;
    if (!dlg) return;
    if (confirmOpen && !dlg.open) dlg.showModal();
    else if (!confirmOpen && dlg.open) dlg.close();
  }, [confirmOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings(draft);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-100">System Settings &amp; Architecture</h1>
        <p className="text-sm text-slate-400">
          Configure persistent SQLite game defaults, spatial overlay visibility, and benchmark engine preferences.
        </p>
      </div>

      <form onSubmit={handleSave} className="rounded-xl border border-slate-800 bg-slate-900/75 p-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="setting-difficulty" className="block text-xs font-medium text-slate-300">
              Default Battle Difficulty
            </label>
            <select
              id="setting-difficulty"
              value={draft.defaultDifficulty}
              onChange={(e) => setDraft({ ...draft, defaultDifficulty: e.target.value as DifficultyLevel })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="recruit">Casual / Peasant (0.75x HP, 0.9x Speed, 250 Gold)</option>
              <option value="standard">Medium / Warrior (1.0x HP, 1.0x Speed, 210 Gold)</option>
              <option value="veteran">Hard / Knight (1.35x HP, 1.12x Speed, -10% Gold)</option>
              <option value="nightmare">Extreme / Overlord (1.65x HP, 1.18x Speed, -15% Gold)</option>
            </select>
          </div>

          <div>
            <label htmlFor="setting-sort-algo" className="block text-xs font-medium text-slate-300">
              Default Tower Targeting Sort Algorithm
            </label>
            <select
              id="setting-sort-algo"
              value={draft.defaultSortAlgo}
              onChange={(e) => setDraft({ ...draft, defaultSortAlgo: e.target.value as SortAlgorithmType })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              {(Object.keys(SORT_LABELS) as SortAlgorithmType[]).map((algo) => (
                <option key={algo} value={algo}>
                  {SORT_LABELS[algo]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="setting-engine" className="block text-xs font-medium text-slate-300">
              Default Benchmark Engine
            </label>
            <select
              id="setting-engine"
              value={draft.benchmarkEngine}
              onChange={(e) => setDraft({ ...draft, benchmarkEngine: e.target.value as 'cpp' | 'ts' })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="cpp">Compiled C++17 DSA Binary (Measured Native)</option>
              <option value="ts">TypeScript In-Browser Engine</option>
            </select>
          </div>

          <div>
            <label htmlFor="setting-graphics" className="block text-xs font-medium text-slate-300">
              3D Graphics Quality
            </label>
            <select
              id="setting-graphics"
              value={draft.graphicsQuality}
              onChange={(e) => setDraft({ ...draft, graphicsQuality: e.target.value as GraphicsQuality })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="low">Low (No Shadows / No Post-FX / Max FPS)</option>
              <option value="medium">Medium (1024px Shadows + SMAA)</option>
              <option value="high">High (2048px Soft Shadows + Bloom + SMAA)</option>
            </select>
          </div>
        </div>

        <div className="space-y-2.5 pt-1">
          <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.showSpatialGrid}
              onChange={(e) => setDraft({ ...draft, showSpatialGrid: e.target.checked })}
              className="h-4 w-4 rounded border-slate-600 bg-slate-950 accent-cyan-500"
            />
            Show QuadTree / KD-Tree spatial partition overlay option enabled by default
          </label>

          <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.reducedMotion}
              onChange={(e) => setDraft({ ...draft, reducedMotion: e.target.checked })}
              className="h-4 w-4 rounded border-slate-600 bg-slate-950 accent-cyan-500"
            />
            Prefer reduced visual particles on Canvas
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            <Save className="h-4 w-4" />
            Save Preferences
          </button>

          {savedNotice && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Saved to SQLite database
            </span>
          )}
        </div>
      </form>

      {/* Architecture & Danger Zone */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-100">UML Class &amp; Data-Flow Diagrams</h2>
          <p className="text-xs text-slate-400">
            Inspect Association, Aggregation, Composition, Inheritance relationships and live engine data flow.
          </p>
          <button
            type="button"
            onClick={onOpenDiagrams}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
          >
            <BookOpen className="h-4 w-4" />
            Open Interactive Diagram Viewer
          </button>
        </div>

        <div className="rounded-xl border border-rose-500/30 bg-rose-950/15 p-4 space-y-3">
          <h2 className="text-sm font-bold text-rose-200">Reset SQLite Profile &amp; Logs</h2>
          <p className="text-xs text-slate-400">
            Clears saved match sessions, benchmark runs, XP, level, and unlocked achievements.
          </p>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3.5 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/25"
          >
            <Trash2 className="h-4 w-4" />
            Reset All Stored Data
          </button>
        </div>
      </div>

      <dialog
        ref={confirmDialogRef}
        aria-labelledby="reset-dialog-title"
        onClose={() => setConfirmOpen(false)}
        className="w-full max-w-md rounded-xl border border-rose-500/40 bg-[#0b1222] p-5 text-slate-100 shadow-2xl"
      >
        <h2 id="reset-dialog-title" className="text-base font-bold text-rose-200">
          Confirm Full SQLite Reset
        </h2>
        <p className="mt-2 text-xs text-slate-300">
          This will permanently erase all recorded tower defense battles, C++ benchmark history, and reset Commander XP to Level 1.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              await onResetAllData();
              setConfirmOpen(false);
            }}
            className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-rose-400"
          >
            Yes, Reset Everything
          </button>
        </div>
      </dialog>
    </div>
  );
};

