import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface DiagramsModalProps {
  open: boolean;
  onClose: () => void;
}

export const DiagramsModal: React.FC<DiagramsModalProps> = ({ open, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<'uml' | 'dfd'>('uml');

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="diagram-modal-title"
      onClose={onClose}
      className="w-full max-w-4xl shadow-2xl shadow-cyan-500/15"
    >
      <div className="flex flex-col max-h-[84dvb]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-cyan-500/20 bg-[#0b1325]">
          <div>
            <h1 id="diagram-modal-title" className="text-lg font-bold text-cyan-300">
              System Architecture: UML Class &amp; Data-Flow Diagrams
            </h1>
            <p className="text-xs text-slate-400">
              Demonstrating Association, Aggregation, Composition, Inheritance &amp; Real-Time DSA Pipeline
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close architecture diagrams"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex gap-2 px-5 py-3 border-b border-slate-800 bg-[#080e1c]">
          <button
            type="button"
            onClick={() => setTab('uml')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              tab === 'uml' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300'
            }`}
          >
            UML Class Diagram
          </button>
          <button
            type="button"
            onClick={() => setTab('dfd')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              tab === 'dfd' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
            }`}
          >
            Data-Flow Diagram (DFD)
          </button>
        </div>

        <div className="p-5 overflow-auto app-scroll bg-[#060b16]">
          {tab === 'uml' ? (
            <figure>
              <svg
                viewBox="0 0 880 500"
                role="img"
                aria-label="UML Class Diagram showing GameEngine, GameMap, Tower, Enemy, TargetingStrategy, WaveManager and DSA structures"
                className="w-full h-auto rounded-xl border border-slate-800 bg-[#091020]"
              >
                <defs>
                  <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L9,3 z" fill="#38bdf8" />
                  </marker>
                  <marker id="inherit" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
                    <path d="M0,0 L10,6 L0,12 z" fill="#091020" stroke="#a855f7" strokeWidth="1.5" />
                  </marker>
                  <marker id="comp" markerWidth="12" markerHeight="12" refX="1" refY="6" orient="auto">
                    <polygon points="0,6 6,2 12,6 6,10" fill="#2dd4bf" />
                  </marker>
                  <marker id="agg" markerWidth="12" markerHeight="12" refX="1" refY="6" orient="auto">
                    <polygon points="0,6 6,2 12,6 6,10" fill="#091020" stroke="#fbbf24" strokeWidth="1.5" />
                  </marker>
                </defs>

                {/* GameEngine */}
                <g transform="translate(320,20)">
                  <rect width="240" height="105" rx="8" fill="#111d35" stroke="#22d3ee" strokeWidth="1.5" />
                  <text x="120" y="22" textAnchor="middle" fill="#67e8f9" fontSize="13" fontWeight="bold">GameEngine</text>
                  <line x1="0" y1="30" x2="240" y2="30" stroke="#1e293b" />
                  <text x="10" y="48" fill="#cbd5e1" fontSize="10">- activeEnemies: DoublyLinkedList</text>
                  <text x="10" y="63" fill="#cbd5e1" fontSize="10">- towers: DynamicArray&lt;Tower&gt;</text>
                  <text x="10" y="78" fill="#cbd5e1" fontSize="10">- undoStack: Stack&lt;Action&gt;</text>
                  <text x="10" y="93" fill="#34d399" fontSize="10">+ update(dt), placeTower(), undo()</text>
                </g>

                {/* GameMap (Composition) */}
                <g transform="translate(30,40)">
                  <rect width="200" height="80" rx="8" fill="#111d35" stroke="#2dd4bf" strokeWidth="1.5" />
                  <text x="100" y="22" textAnchor="middle" fill="#5eead4" fontSize="12" fontWeight="bold">GameMap &amp; GridCells</text>
                  <line x1="0" y1="30" x2="200" y2="30" stroke="#1e293b" />
                  <text x="10" y="48" fill="#cbd5e1" fontSize="10">- grid: TerrainType[][]</text>
                  <text x="10" y="65" fill="#cbd5e1" fontSize="10">- groundPath: GridCoord[]</text>
                </g>

                {/* WaveManager & ResourceManager */}
                <g transform="translate(640,35)">
                  <rect width="210" height="85" rx="8" fill="#111d35" stroke="#f59e0b" strokeWidth="1.5" />
                  <text x="105" y="22" textAnchor="middle" fill="#fcd34d" fontSize="12" fontWeight="bold">WaveManager &amp; Resources</text>
                  <line x1="0" y1="30" x2="210" y2="30" stroke="#1e293b" />
                  <text x="10" y="48" fill="#cbd5e1" fontSize="10">- spawnQueue: Queue&lt;SpawnTask&gt;</text>
                  <text x="10" y="64" fill="#cbd5e1" fontSize="10">- difficultyTree: KaryTree</text>
                  <text x="10" y="78" fill="#cbd5e1" fontSize="10">- statsTable: HashTable&lt;number&gt;</text>
                </g>

                {/* Abstract Tower */}
                <g transform="translate(80,190)">
                  <rect width="230" height="90" rx="8" fill="#131b31" stroke="#a855f7" strokeWidth="1.5" />
                  <text x="115" y="20" textAnchor="middle" fill="#d8b4fe" fontSize="12" fontWeight="bold">&lt;&lt;abstract&gt;&gt; Tower</text>
                  <line x1="0" y1="28" x2="230" y2="28" stroke="#1e293b" />
                  <text x="10" y="46" fill="#cbd5e1" fontSize="10">- damage, range, attackSpeed</text>
                  <text x="10" y="62" fill="#cbd5e1" fontSize="10">- strategy: TargetingStrategy</text>
                  <text x="10" y="78" fill="#34d399" fontSize="10">+ executeAttack(target)*</text>
                </g>

                {/* Abstract Enemy */}
                <g transform="translate(560,190)">
                  <rect width="230" height="90" rx="8" fill="#131b31" stroke="#a855f7" strokeWidth="1.5" />
                  <text x="115" y="20" textAnchor="middle" fill="#d8b4fe" fontSize="12" fontWeight="bold">&lt;&lt;abstract&gt;&gt; Enemy</text>
                  <line x1="0" y1="28" x2="230" y2="28" stroke="#1e293b" />
                  <text x="10" y="46" fill="#cbd5e1" fontSize="10">- id, health, speed, armor</text>
                  <text x="10" y="62" fill="#cbd5e1" fontSize="10">+ takeDamage(), update(dt)</text>
                  <text x="10" y="78" fill="#34d399" fontSize="10">+ updateAbility(dt)*</text>
                </g>

                {/* TargetingStrategy */}
                <g transform="translate(325,215)">
                  <rect width="200" height="70" rx="8" fill="#111d35" stroke="#38bdf8" strokeWidth="1.5" />
                  <text x="100" y="20" textAnchor="middle" fill="#7dd3fc" fontSize="11" fontWeight="bold">&lt;&lt;interface&gt;&gt; TargetingStrategy</text>
                  <line x1="0" y1="28" x2="200" y2="28" stroke="#1e293b" />
                  <text x="10" y="46" fill="#cbd5e1" fontSize="10">+ selectTarget(tower, candidates)</text>
                  <text x="10" y="60" fill="#94a3b8" fontSize="9">Uses Manual Sorts / PriorityQueue</text>
                </g>

                {/* Subclasses */}
                <g transform="translate(40,350)">
                  <rect width="340" height="68" rx="8" fill="#0f172a" stroke="#64748b" />
                  <text x="170" y="20" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="bold">Concrete Tower Subclasses</text>
                  <text x="14" y="40" fill="#38bdf8" fontSize="10">BasicTower | SniperTower | RapidTower</text>
                  <text x="14" y="56" fill="#f97316" fontSize="10">SplashTower | SlowTower | LaserTower</text>
                </g>

                <g transform="translate(500,350)">
                  <rect width="340" height="68" rx="8" fill="#0f172a" stroke="#64748b" />
                  <text x="170" y="20" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="bold">Concrete Enemy Subclasses</text>
                  <text x="14" y="40" fill="#fde047" fontSize="10">NormalEnemy | FastEnemy | HeavyEnemy</text>
                  <text x="14" y="56" fill="#fb7185" fontSize="10">ArmoredEnemy | BossEnemy | FlyingEnemy</text>
                </g>

                {/* Relationships */}
                <line x1="320" y1="75" x2="230" y2="75" stroke="#2dd4bf" strokeWidth="1.6" markerStart="url(#comp)" />
                <text x="275" y="66" textAnchor="middle" fill="#5eead4" fontSize="9">Composition</text>

                <line x1="560" y1="75" x2="640" y2="75" stroke="#fbbf24" strokeWidth="1.6" markerStart="url(#agg)" />
                <text x="600" y="66" textAnchor="middle" fill="#fcd34d" fontSize="9">Aggregation</text>

                <line x1="370" y1="125" x2="220" y2="190" stroke="#fbbf24" strokeWidth="1.6" markerStart="url(#agg)" />
                <line x1="500" y1="125" x2="650" y2="190" stroke="#fbbf24" strokeWidth="1.6" markerStart="url(#agg)" />
                <line x1="310" y1="245" x2="325" y2="245" stroke="#38bdf8" strokeWidth="1.5" markerEnd="url(#arrow)" />
                <line x1="525" y1="245" x2="560" y2="245" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4,3" markerEnd="url(#arrow)" />
                <text x="542" y="236" textAnchor="middle" fill="#7dd3fc" fontSize="9">Assoc</text>

                <line x1="195" y1="350" x2="195" y2="280" stroke="#a855f7" strokeWidth="1.6" markerEnd="url(#inherit)" />
                <line x1="670" y1="350" x2="670" y2="280" stroke="#a855f7" strokeWidth="1.6" markerEnd="url(#inherit)" />
                <text x="440" y="465" textAnchor="middle" fill="#94a3b8" fontSize="11">
                  Legend: Filled Diamond = Composition | Hollow Diamond = Aggregation | Hollow Triangle = Inheritance | Arrow = Association
                </text>
              </svg>
              <figcaption className="mt-2 text-xs text-slate-400">
                Figure 1: Object-oriented class hierarchy and data structure ownership inside the Game Engine.
              </figcaption>
            </figure>
          ) : (
            <figure>
              <svg
                viewBox="0 0 880 400"
                role="img"
                aria-label="Data Flow Diagram showing game loop, DSA pipeline, C++ benchmark runner and SQLite persistence"
                className="w-full h-auto rounded-xl border border-slate-800 bg-[#091020]"
              >
                <defs>
                  <marker id="dfdArrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L9,3 z" fill="#34d399" />
                  </marker>
                </defs>

                {[
                  { x: 25, y: 40, w: 165, h: 70, title: '1. Wave Queue (FIFO)', sub: 'Enqueues enemy wave tasks', col: '#38bdf8' },
                  { x: 240, y: 40, w: 185, h: 70, title: '2. Doubly Linked List', sub: 'O(1) active enemy insert/delete', col: '#2dd4bf' },
                  { x: 475, y: 40, w: 180, h: 70, title: '3. QuadTree / KD-Tree', sub: 'Spatial range candidate filter', col: '#a855f7' },
                  { x: 700, y: 40, w: 155, h: 70, title: '4. Sorter / Max-Heap', sub: 'Selects optimal target', col: '#f59e0b' },
                  { x: 700, y: 180, w: 155, h: 70, title: '5. Projectile & Hit', sub: 'Armor, AoE, Slow, Burn', col: '#f43f5e' },
                  { x: 475, y: 180, w: 180, h: 70, title: '6. HashTable & SegTree', sub: 'O(1) stats + Min/Max HP', col: '#22c55e' },
                  { x: 240, y: 180, w: 185, h: 70, title: '7. Express + SQLite', sub: 'Persists history & XP', col: '#38bdf8' },
                  { x: 25, y: 180, w: 165, h: 70, title: '8. C++17 DSA Engine', sub: 'Benchmarks 100..10,000 n', col: '#eab308' },
                ].map((b) => (
                  <g key={b.title} transform={`translate(${b.x},${b.y})`}>
                    <rect width={b.w} height={b.h} rx="10" fill="#111d35" stroke={b.col} strokeWidth="1.6" />
                    <text x={b.w / 2} y="28" textAnchor="middle" fill={b.col} fontSize="11.5" fontWeight="bold">{b.title}</text>
                    <text x={b.w / 2} y="48" textAnchor="middle" fill="#cbd5e1" fontSize="10">{b.sub}</text>
                  </g>
                ))}

                <line x1="190" y1="75" x2="236" y2="75" stroke="#34d399" strokeWidth="2" markerEnd="url(#dfdArrow)" />
                <line x1="425" y1="75" x2="471" y2="75" stroke="#34d399" strokeWidth="2" markerEnd="url(#dfdArrow)" />
                <line x1="655" y1="75" x2="696" y2="75" stroke="#34d399" strokeWidth="2" markerEnd="url(#dfdArrow)" />
                <line x1="777" y1="110" x2="777" y2="176" stroke="#34d399" strokeWidth="2" markerEnd="url(#dfdArrow)" />
                <line x1="700" y1="215" x2="659" y2="215" stroke="#34d399" strokeWidth="2" markerEnd="url(#dfdArrow)" />
                <line x1="475" y1="215" x2="429" y2="215" stroke="#34d399" strokeWidth="2" markerEnd="url(#dfdArrow)" />
                <line x1="240" y1="215" x2="194" y2="215" stroke="#34d399" strokeWidth="2" markerEnd="url(#dfdArrow)" />

                <rect x="25" y="295" width="830" height="75" rx="10" fill="#0c1528" stroke="#334155" />
                <text x="440" y="322" textAnchor="middle" fill="#7dd3fc" fontSize="12" fontWeight="bold">
                  Canvas 2D Renderer (60 FPS) + DSA Laboratory Step Tracer + Performance Analytics Charts
                </text>
                <text x="440" y="346" textAnchor="middle" fill="#94a3b8" fontSize="10.5">
                  Every frame updates active telemetry (comparisons, swaps, spatial checks avoided, Segment Tree HP bounds, Stack undo depth).
                </text>
              </svg>
              <figcaption className="mt-2 text-xs text-slate-400">
                Figure 2: End-to-end data flow from Wave Queue spawning to C++17 benchmarking and SQLite persistence.
              </figcaption>
            </figure>
          )}
        </div>
      </div>
    </dialog>
  );
};

