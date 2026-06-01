import React from 'react';

interface StartScreenProps {
  onStart: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen bg-gray-950 font-mono overflow-y-auto">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,255,136,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,136,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '30px 30px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-start min-h-screen px-4 py-10 sm:py-16">
        <div className="w-full max-w-2xl text-center">

          {/* ── Title ─────────────────────────────────────────────────────── */}
          <div className="mb-6 sm:mb-8">
            <div className="text-green-400 text-xs tracking-widest uppercase mb-2 opacity-70">
              TACTICAL STEALTH STRATEGY
            </div>
            <h1
              className="text-5xl sm:text-7xl font-black tracking-tight mb-1 leading-none"
              style={{
                background: 'linear-gradient(135deg, #00ff88 0%, #00aaff 50%, #ff3333 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              BELIEF
            </h1>
            <h1
              className="text-5xl sm:text-7xl font-black tracking-tight leading-none"
              style={{
                background: 'linear-gradient(135deg, #ff3333 0%, #ff6600 50%, #ffdd00 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              WARS
            </h1>
          </div>

          {/* ── Description ───────────────────────────────────────────────── */}
          <div className="mb-8 text-gray-400 text-sm leading-relaxed max-w-lg mx-auto px-2">
            <p className="mb-2">
              A game of <span className="text-green-400">probability</span> and{' '}
              <span className="text-red-400">deception</span> on a{' '}
              <span className="text-white font-bold">10×10 grid</span>.
            </p>
            <p className="mb-2">
              The <span className="text-green-400 font-bold">Ghost</span> spawns randomly, moves
              one step at a time, and must complete{' '}
              <span className="text-yellow-400 font-bold">3 of 5 objectives</span> to win.
            </p>
            <p>
              The <span className="text-blue-400 font-bold">Seeker</span> uses a live probability
              heatmap and AI-powered MCTS to hunt the Ghost across{' '}
              <span className="text-white font-bold">2 full cycles</span> per round.
            </p>
          </div>

          {/* ── Feature pills ─────────────────────────────────────────────── */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {[
              { label: 'Belief-State Diffusion', color: 'text-green-400 border-green-800 bg-green-950' },
              { label: 'AND-OR Search',          color: 'text-purple-400 border-purple-800 bg-purple-950' },
              { label: 'MCTS AI',                color: 'text-blue-400 border-blue-800 bg-blue-950' },
              { label: 'A* Pathfinding',         color: 'text-yellow-400 border-yellow-800 bg-yellow-950' },
              { label: 'Pattern Learning',       color: 'text-orange-400 border-orange-800 bg-orange-950' },
              { label: 'Best-of-3 Match',        color: 'text-red-400 border-red-800 bg-red-950' },
            ].map(({ label, color }) => (
              <span key={label} className={`px-3 py-1 rounded-full border text-xs font-bold ${color}`}>
                {label}
              </span>
            ))}
          </div>

          {/* ── Start button ──────────────────────────────────────────────── */}
          <button
            className="px-8 sm:px-12 py-3 sm:py-4 text-lg sm:text-xl font-black tracking-widest uppercase
              bg-green-500 hover:bg-green-400 text-black rounded-lg transition-all duration-200
              hover:scale-105 active:scale-95 shadow-lg w-full sm:w-auto"
            onClick={onStart}
            style={{ boxShadow: '0 0 30px rgba(0,255,136,0.3)' }}
          >
            START NEW MATCH
          </button>

          {/* ── Rules grid ────────────────────────────────────────────────── */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left text-xs text-gray-500">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="text-green-400 font-bold mb-2">👻 Ghost Wins By</div>
              <ul className="space-y-1">
                <li>• Completing <span className="text-yellow-400">3 of 5</span> objectives</li>
                <li>• <span className="text-yellow-400">AND</span> surviving both Collapses</li>
                <li>• Misleading the Seeker's heatmap</li>
                <li>• Moving adjacently (↑↓←→), 8 AP in Manipulation, 20 AP in Objective</li>
              </ul>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="text-blue-400 font-bold mb-2">🔍 Seeker Wins By</div>
              <ul className="space-y-1">
                <li>• Locking the Ghost's exact cell</li>
                <li>• Using <span className="text-yellow-400">10 AP</span> wisely (Scan: 2, Lock: 4)</li>
                <li>• Following MCTS recommendations</li>
                <li>• Acting in either of 2 Collapse phases (10 AP each)</li>
              </ul>
            </div>
          </div>

          {/* ── Round structure ───────────────────────────────────────────── */}
          <div className="mt-6 bg-gray-900/60 border border-gray-800 rounded-lg p-4 text-left text-xs text-gray-500">
            <div className="text-gray-300 font-bold mb-2 text-center">Round = 2 Cycles</div>
            <div className="flex flex-wrap justify-center gap-1 mb-1">
              {['RECON', 'MANIP', 'OBJECTIVE', 'EVENTS', 'COLLAPSE'].map((phase, i) => (
                <React.Fragment key={phase}>
                  <span className="text-gray-400">{phase}</span>
                  {i < 4 && <span className="text-gray-700">→</span>}
                </React.Fragment>
              ))}
              <span className="text-gray-700 mx-1">×2</span>
            </div>
            <div className="text-center text-gray-600">
              Roles assigned randomly each round · 10×10 grid · 5 objectives
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
