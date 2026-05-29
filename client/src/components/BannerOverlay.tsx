import React, { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { GamePhase, GameRole } from '../types/client.types';

// ─── Phase metadata ───────────────────────────────────────────────────────────

const PHASE_META: Record<GamePhase, { label: string; icon: string; color: string; bg: string; border: string }> = {
  [GamePhase.RECON]:         { label: 'RECON',        icon: '🔭', color: 'text-indigo-300',  bg: 'bg-indigo-950',  border: 'border-indigo-500'  },
  [GamePhase.MANIPULATION]:  { label: 'MANIPULATION', icon: '🎭', color: 'text-yellow-300',  bg: 'bg-yellow-950',  border: 'border-yellow-500'  },
  [GamePhase.OBJECTIVE]:     { label: 'OBJECTIVE',    icon: '🎯', color: 'text-green-300',   bg: 'bg-green-950',   border: 'border-green-500'   },
  [GamePhase.AND_OR_EVENTS]: { label: 'EVENTS',       icon: '⚡', color: 'text-purple-300',  bg: 'bg-purple-950',  border: 'border-purple-500'  },
  [GamePhase.COLLAPSE]:      { label: 'COLLAPSE',     icon: '🔒', color: 'text-red-300',     bg: 'bg-red-950',     border: 'border-red-500'     },
};

const WIN_CONDITION_TEXT: Record<string, string> = {
  objectives_completed: 'Ghost completed all objectives and survived!',
  ghost_locked:         'Seeker locked the Ghost\'s position!',
  ghost_survived:       'Ghost survived but missed objectives.',
};

const WIN_CONDITION_ICON: Record<string, string> = {
  objectives_completed: '🎯',
  ghost_locked:         '🔒',
  ghost_survived:       '❌',
};

// ─── Auto-dismiss durations ───────────────────────────────────────────────────
const PHASE_END_DURATION  = 2000; // 2s — brief, non-intrusive
const CYCLE_END_DURATION  = 3500; // 3.5s — more significant
const ROUND_END_DURATION  = 5000; // 5s — important, give time to read

/**
 * BannerOverlay — non-blocking notification banners for:
 *   - Phase transitions (slide-in top banner, 2s)
 *   - Cycle completions (centred card, 3.5s)
 *   - Round results (centred modal card, 5s)
 *
 * Stacks above AlertOverlay (z-40) but below nothing critical.
 */
export const BannerOverlay: React.FC = () => {
  const { banner, dismissBanner } = useGameStore();

  const duration =
    banner.type === 'round_end' ? ROUND_END_DURATION :
    banner.type === 'cycle_end' ? CYCLE_END_DURATION :
    PHASE_END_DURATION;

  useEffect(() => {
    if (!banner.type) return;
    const t = setTimeout(dismissBanner, duration);
    return () => clearTimeout(t);
  }, [banner.type, banner.phase, banner.round, duration, dismissBanner]);

  if (!banner.type) return null;

  // ── Phase end — slim top banner ───────────────────────────────────────────
  if (banner.type === 'phase_end' && banner.phase) {
    const meta = PHASE_META[banner.phase];
    const roleLabel = banner.humanRole === GameRole.GHOST ? '👻 Ghost' : '🔍 Seeker';
    return (
      <div
        className="fixed top-0 inset-x-0 z-40 flex justify-center pointer-events-none"
        style={{ animation: 'slideDown 0.3s ease-out' }}
      >
        <div
          className={`mt-2 flex items-center gap-3 px-5 py-2.5 rounded-xl border font-mono shadow-2xl
            ${meta.bg} ${meta.border} ${meta.color}`}
          style={{ boxShadow: `0 4px 32px rgba(0,0,0,0.6)` }}
        >
          <span className="text-xl">{meta.icon}</span>
          <div className="flex flex-col leading-tight">
            <span className="font-black text-sm tracking-widest uppercase">
              {meta.label} PHASE ENDED
            </span>
            <span className="text-xs opacity-60">
              You are playing as {roleLabel}
            </span>
          </div>
          <div className="ml-2 w-1 h-8 rounded-full bg-current opacity-30" />
          <span className="text-xs opacity-50">Next phase starting…</span>
        </div>
        <BannerStyles />
      </div>
    );
  }

  // ── Cycle end — centred card ──────────────────────────────────────────────
  if (banner.type === 'cycle_end') {
    const roleLabel = banner.humanRole === GameRole.GHOST ? '👻 Ghost' : '🔍 Seeker';
    const cycleNum  = banner.cycleNumber ?? 1;
    return (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
        style={{ animation: 'fadeIn 0.25s ease-out' }}
      >
        <div
          className="text-center px-10 py-7 rounded-2xl border-2 font-mono shadow-2xl
            bg-gray-900 border-cyan-500 text-cyan-300"
          style={{ boxShadow: '0 0 60px rgba(0,220,255,0.25)', animation: 'scaleIn 0.3s ease-out' }}
        >
          <div className="text-4xl mb-2">🔄</div>
          <div className="text-2xl font-black tracking-widest mb-1">
            CYCLE {cycleNum} COMPLETE
          </div>
          <div className="text-sm opacity-70 mb-3">
            Round continues — Cycle {cycleNum + 1} of 2 begins
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
            bg-cyan-900/50 border border-cyan-700 text-xs font-bold">
            <span>Your role:</span>
            <span className={banner.humanRole === GameRole.GHOST ? 'text-green-400' : 'text-blue-400'}>
              {roleLabel}
            </span>
          </div>
          <div className="mt-4 text-xs opacity-40">AP reset · Belief diffused · Continuing…</div>
        </div>
        <BannerStyles />
      </div>
    );
  }

  // ── Round end — centred result modal ──────────────────────────────────────
  if (banner.type === 'round_end') {
    const humanWon    = banner.humanWon ?? false;
    const roleLabel   = banner.humanRole === GameRole.GHOST ? '👻 Ghost' : '🔍 Seeker';
    const winnerRole  = banner.winner === GameRole.GHOST ? '👻 Ghost' : '🔍 Seeker';
    const wcText      = WIN_CONDITION_TEXT[banner.winCondition ?? ''] ?? '';
    const wcIcon      = WIN_CONDITION_ICON[banner.winCondition ?? ''] ?? '•';
    const humanWins   = banner.humanWins ?? 0;
    const aiWins      = banner.aiWins ?? 0;

    return (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.65)', animation: 'fadeIn 0.2s ease-out' }}
        onClick={dismissBanner}
      >
        <div
          className={`relative text-center px-10 py-8 rounded-2xl border-2 font-mono shadow-2xl max-w-sm w-full mx-4
            ${humanWon
              ? 'bg-yellow-950 border-yellow-400 text-yellow-300'
              : 'bg-gray-900 border-gray-600 text-gray-300'
            }`}
          style={{
            boxShadow: humanWon
              ? '0 0 80px rgba(255,200,0,0.3)'
              : '0 0 40px rgba(0,0,0,0.8)',
            animation: 'scaleIn 0.3s ease-out',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Result emoji */}
          <div className="text-5xl mb-3">{humanWon ? '🏆' : '💀'}</div>

          {/* Win / Loss headline */}
          <div className={`text-3xl font-black tracking-widest mb-1 ${humanWon ? 'text-yellow-400' : 'text-gray-400'}`}>
            {humanWon ? 'ROUND WON!' : 'ROUND LOST'}
          </div>

          {/* Round number */}
          <div className="text-xs opacity-50 mb-4 uppercase tracking-wider">
            Round {banner.round} complete
          </div>

          {/* Your role */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-xs opacity-60">You played as</span>
            <span className={`font-bold text-sm px-2 py-0.5 rounded-full border ${
              banner.humanRole === GameRole.GHOST
                ? 'text-green-400 border-green-700 bg-green-950'
                : 'text-blue-400 border-blue-700 bg-blue-950'
            }`}>
              {roleLabel}
            </span>
          </div>

          {/* Winner role */}
          <div className="text-sm mb-3 opacity-80">
            <span className="opacity-60">Winner: </span>
            <span className="font-bold">{winnerRole}</span>
          </div>

          {/* Win condition */}
          <div className={`text-xs px-3 py-2 rounded-lg mb-4 border ${
            humanWon
              ? 'bg-yellow-900/40 border-yellow-700 text-yellow-200'
              : 'bg-gray-800 border-gray-700 text-gray-400'
          }`}>
            {wcIcon} {wcText}
            {banner.winCondition !== 'ghost_locked' && (
              <div className="mt-0.5 opacity-70">
                Objectives captured: {banner.objectivesCompleted} / 5
              </div>
            )}
          </div>

          {/* Score so far */}
          <div className="flex items-center justify-center gap-6 mb-4">
            <div className="flex flex-col items-center">
              <span className="text-xs opacity-50 mb-0.5">YOU</span>
              <span className={`text-3xl font-black ${humanWon ? 'text-yellow-400' : 'text-gray-500'}`}>
                {humanWins}
              </span>
              <div className="flex gap-1 mt-1">
                {[0, 1].map(i => (
                  <div key={i} className={`w-4 h-4 rounded border ${
                    i < humanWins ? 'bg-yellow-400 border-yellow-300' : 'bg-gray-800 border-gray-600'
                  }`} />
                ))}
              </div>
            </div>
            <span className="text-gray-600 text-xl font-bold">vs</span>
            <div className="flex flex-col items-center">
              <span className="text-xs opacity-50 mb-0.5">AI</span>
              <span className={`text-3xl font-black ${!humanWon ? 'text-red-400' : 'text-gray-500'}`}>
                {aiWins}
              </span>
              <div className="flex gap-1 mt-1">
                {[0, 1].map(i => (
                  <div key={i} className={`w-4 h-4 rounded border ${
                    i < aiWins ? 'bg-red-500 border-red-400' : 'bg-gray-800 border-gray-600'
                  }`} />
                ))}
              </div>
            </div>
          </div>

          {/* Dismiss hint */}
          <div className="text-xs opacity-30 mt-2">
            Click anywhere or wait to continue…
          </div>
        </div>
        <BannerStyles />
      </div>
    );
  }

  return null;
};

// ─── Shared keyframe styles ───────────────────────────────────────────────────
const BannerStyles: React.FC = () => (
  <style>{`
    @keyframes slideDown {
      from { transform: translateY(-100%); opacity: 0; }
      to   { transform: translateY(0);     opacity: 1; }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes scaleIn {
      from { transform: scale(0.85) translateY(-12px); opacity: 0; }
      to   { transform: scale(1)    translateY(0);     opacity: 1; }
    }
  `}</style>
);
