import React from 'react';
import { PageRoute } from '../types/game';

interface LayoutProps {
  activeRoute: PageRoute;
  onNavigate: (route: PageRoute) => void;
  onOpenDiagrams: () => void;
  playerLevel: number;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  activeRoute,
  onNavigate,
  children,
}) => {
  const isFullGameView = activeRoute === 'home' || activeRoute === 'play';

  return (
    <div className="min-h-dvh flex flex-col bg-[#0c140e] text-slate-100">
      <a href="#main-content" className="skip-link visually-hidden">
        Skip to main content
      </a>

      {/* Clean Back-to-Game bar ONLY if user entered optional utility views from Settings */}
      {!isFullGameView && (
        <header className="px-4 py-2.5 border-b border-amber-700/40 bg-[#18120c] flex items-center justify-between">
          <span className="text-xs font-extrabold tracking-wider text-amber-300 uppercase">
            Game Engine Tools
          </span>
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="px-3.5 py-1.5 rounded-lg text-xs font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950"
          >
            Back to Game Title
          </button>
        </header>
      )}

      <main
        id="main-content"
        tabIndex={-1}
        className={`flex-1 min-w-0 ${isFullGameView ? '' : 'p-4 sm:p-6 app-scroll'}`}
      >
        {children}
      </main>
    </div>
  );
};
