import React, { useCallback, useEffect, useState } from 'react';
import { DifficultyLevel, PageRoute, SortAlgorithmType } from './types/game';
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

const DEFAULT_PROFILE: PlayerProfileData = {
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

const DEFAULT_SETTINGS: AppSettings = {
  defaultDifficulty: 'standard',
  defaultSortAlgo: 'quick',
  benchmarkEngine: 'cpp',
  reducedMotion: false,
  showSpatialGrid: false,
};

export function App() {
  const [route, setRoute] = useState<PageRoute>('home');
  const [selectedMapId, setSelectedMapId] = useState<string>('circuit-valley');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('standard');
  const [diagramsOpen, setDiagramsOpen] = useState(false);
  const [profile, setProfile] = useState<PlayerProfileData>(DEFAULT_PROFILE);
  const [sessions, setSessions] = useState<GameHistoryRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const loadData = useCallback(async () => {
    try {
      const [profRes, sessRes, setRes] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/game-sessions'),
        fetch('/api/settings'),
      ]);
      if (profRes.ok) {
        const p = (await profRes.json()) as PlayerProfileData;
        setProfile(p);
      }
      if (sessRes.ok) {
        const s = (await sessRes.json()) as GameHistoryRecord[];
        setSessions(Array.isArray(s) ? s : []);
      }
      if (setRes.ok) {
        const raw = (await setRes.json()) as Record<string, string>;
        const diff = (raw.defaultDifficulty as DifficultyLevel) || 'standard';
        setSelectedDifficulty(diff);
        setSettings({
          defaultDifficulty: diff,
          defaultSortAlgo: (raw.defaultSortAlgo as SortAlgorithmType) || 'quick',
          benchmarkEngine: raw.benchmarkEngine === 'ts' ? 'ts' : 'cpp',
          reducedMotion: raw.reducedMotion === 'true',
          showSpatialGrid: raw.showSpatialGrid === 'true',
        });
      }
    } catch {
      // Backend might still be starting up
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSaveSettings = async (next: AppSettings) => {
    setSettings(next);
    setSelectedDifficulty(next.defaultDifficulty);
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        defaultDifficulty: next.defaultDifficulty,
        defaultSortAlgo: next.defaultSortAlgo,
        benchmarkEngine: next.benchmarkEngine,
        reducedMotion: String(next.reducedMotion),
        showSpatialGrid: String(next.showSpatialGrid),
      }),
    });
  };

  const handleResetAllData = async () => {
    await fetch('/api/game-sessions', { method: 'DELETE' });
    await loadData();
  };

  const renderPage = () => {
    switch (route) {
      case 'home':
        return (
          <HomeDashboard
            profile={profile}
            recentGames={sessions}
            selectedMapId={selectedMapId}
            selectedDifficulty={selectedDifficulty}
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
            onExitToTitle={() => setRoute('home')}
            onSessionSaved={() => {
              void loadData();
            }}
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
