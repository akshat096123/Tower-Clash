import React, { useCallback, useEffect, useState } from 'react';
import { DifficultyLevel, GraphicsQuality, PageRoute, SortAlgorithmType } from './types/game';
import { Layout } from './components/Layout';
import { DiagramsModal } from './components/DiagramsModal';
import { GameHistoryRecord, HomeDashboard, PlayerProfileData } from './pages/HomeDashboard';
import { PlayGame } from './pages/PlayGame';
import { MapsPage } from './pages/MapsPage';
import { TowerCollection } from './pages/TowerCollection';
import { DsaLab } from './pages/DsaLab';
import { PerformanceAnalysis } from './pages/PerformanceAnalysis';
import { GameHistory } from './pages/GameHistory';
import { AppSettings, SettingsPage } from './pages/SettingsPage';
import {
  clearLocalTelemetry,
  DEFAULT_LOCAL_PROFILE,
  loadLocalProfile,
  loadLocalSessions,
  loadLocalSettings,
  mergeProfiles,
  mergeSessions,
  saveLocalProfile,
  saveLocalSessions,
  saveLocalSettings,
} from './utils/sessionStorage';

const DEFAULT_PROFILE: PlayerProfileData = DEFAULT_LOCAL_PROFILE;

const DEFAULT_SETTINGS: AppSettings = {
  defaultDifficulty: 'standard',
  defaultSortAlgo: 'quick',
  benchmarkEngine: 'cpp',
  reducedMotion: false,
  showSpatialGrid: false,
  graphicsQuality: 'high',
};

export function App() {
  const [route, setRoute] = useState<PageRoute>('home');
  const [selectedMapId, setSelectedMapId] = useState<string>('circuit-valley');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>(
    () => loadLocalSettings()?.defaultDifficulty ?? 'standard'
  );
  const [diagramsOpen, setDiagramsOpen] = useState(false);
  const [profile, setProfile] = useState<PlayerProfileData>(
    () => loadLocalProfile() ?? DEFAULT_PROFILE
  );
  const [sessions, setSessions] = useState<GameHistoryRecord[]>(() => loadLocalSessions());
  const [settings, setSettings] = useState<AppSettings>(
    () => loadLocalSettings() ?? DEFAULT_SETTINGS
  );

  const loadData = useCallback(async () => {
    const localSessions = loadLocalSessions();
    const localProfile = loadLocalProfile();
    const localSettings = loadLocalSettings();

    try {
      const [profRes, sessRes, setRes] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/game-sessions'),
        fetch('/api/settings'),
      ]);
      if (profRes.ok) {
        const p = (await profRes.json()) as PlayerProfileData;
        const mergedProfile = mergeProfiles(p, localProfile);
        saveLocalProfile(mergedProfile);
        setProfile(mergedProfile);
      } else if (localProfile) {
        setProfile(localProfile);
      }

      if (sessRes.ok) {
        const s = (await sessRes.json()) as GameHistoryRecord[];
        const merged = mergeSessions(Array.isArray(s) ? s : [], localSessions);
        saveLocalSessions(merged);
        setSessions(merged);
      } else if (localSessions.length > 0) {
        setSessions(localSessions);
      }

      if (setRes.ok) {
        const raw = (await setRes.json()) as Record<string, string>;
        const diff =
          localSettings?.defaultDifficulty ?? ((raw.defaultDifficulty as DifficultyLevel) || 'standard');
        const nextSettings: AppSettings = localSettings ?? {
          defaultDifficulty: diff,
          defaultSortAlgo: (raw.defaultSortAlgo as SortAlgorithmType) || 'quick',
          benchmarkEngine: raw.benchmarkEngine === 'ts' ? 'ts' : 'cpp',
          reducedMotion: raw.reducedMotion === 'true',
          showSpatialGrid: raw.showSpatialGrid === 'true',
          graphicsQuality:
            raw.graphicsQuality === 'low' || raw.graphicsQuality === 'medium' ? raw.graphicsQuality : 'high',
        };
        setSelectedDifficulty(nextSettings.defaultDifficulty);
        setSettings(nextSettings);
        saveLocalSettings(nextSettings);
      }
    } catch {
      // Offline / backend starting up — localStorage state remains intact
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSaveSettings = async (next: AppSettings) => {
    setSettings(next);
    setSelectedDifficulty(next.defaultDifficulty);
    saveLocalSettings(next);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultDifficulty: next.defaultDifficulty,
          defaultSortAlgo: next.defaultSortAlgo,
          benchmarkEngine: next.benchmarkEngine,
          reducedMotion: String(next.reducedMotion),
          showSpatialGrid: String(next.showSpatialGrid),
          graphicsQuality: next.graphicsQuality,
        }),
      });
    } catch {
      // Local settings already saved
    }
  };

  const handleResetAllData = async () => {
    clearLocalTelemetry();
    setSessions([]);
    setProfile(DEFAULT_PROFILE);
    try {
      await fetch('/api/game-sessions', { method: 'DELETE' });
    } catch {
      // Local data already cleared
    }
    await loadData();
  };

  const handleSessionSaved = useCallback(
    (saved?: { session: GameHistoryRecord; profile?: PlayerProfileData }) => {
      if (saved?.session) {
        setSessions((prev) => {
          const merged = mergeSessions([saved.session], mergeSessions(prev, loadLocalSessions()));
          saveLocalSessions(merged);
          return merged;
        });
      }
      if (saved?.profile) {
        setProfile((prev) => {
          const merged = mergeProfiles(saved.profile ?? null, prev);
          saveLocalProfile(merged);
          return merged;
        });
      }
    },
    []
  );

  const renderPage = () => {
    switch (route) {
      case 'home':
        return (
          <HomeDashboard
            profile={profile}
            recentGames={sessions}
            selectedMapId={selectedMapId}
            selectedDifficulty={selectedDifficulty}
            graphicsQuality={settings.graphicsQuality}
            onStartBattle={(mapId, diff) => {
              setSelectedMapId(mapId);
              setSelectedDifficulty(diff);
              setRoute('play');
            }}
            onNavigate={setRoute}
            onOpenDiagrams={() => setDiagramsOpen(true)}
          />
        );
      case 'play':
        return (
          <PlayGame
            initialMapId={selectedMapId}
            defaultDifficulty={selectedDifficulty}
            defaultSortAlgo={settings.defaultSortAlgo}
            showSpatialGridDefault={settings.showSpatialGrid}
            graphicsQuality={settings.graphicsQuality}
            onChangeGraphicsQuality={(q) => {
              void handleSaveSettings({ ...settings, graphicsQuality: q });
            }}
            onExitToTitle={() => setRoute('home')}
            onSessionSaved={handleSessionSaved}
          />
        );
      case 'maps':
        return (
          <MapsPage
            selectedMapId={selectedMapId}
            onSelectAndPlay={(mapId) => {
              setSelectedMapId(mapId);
              setRoute('play');
            }}
          />
        );
      case 'towers':
        return <TowerCollection />;
      case 'lab':
        return <DsaLab initialCategory="sorting" heading="Algorithm Sandbox" />;
      case 'structures':
        return <DsaLab initialCategory="trees" heading="Data Structures Explorer" />;
      case 'visualizer':
        return <DsaLab initialCategory="graphs" heading="Pathfinding Visualizer" />;
      case 'performance':
        return <PerformanceAnalysis defaultEngine={settings.benchmarkEngine} />;
      case 'history':
        return (
          <GameHistory
            sessions={sessions}
            profile={profile}
            onRefresh={() => {
              void loadData();
            }}
          />
        );
      case 'settings':
        return (
          <SettingsPage
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onResetAllData={handleResetAllData}
            onOpenDiagrams={() => setDiagramsOpen(true)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Layout
        activeRoute={route}
        onNavigate={setRoute}
        onOpenDiagrams={() => setDiagramsOpen(true)}
        playerLevel={profile.level}
      >
        {renderPage()}
      </Layout>
      <DiagramsModal open={diagramsOpen} onClose={() => setDiagramsOpen(false)} />
    </>
  );
}

export default App;
