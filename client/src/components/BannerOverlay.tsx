import React, { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { GamePhase, GameRole } from '../types/client.types';

// ─── Phase metadata ───────────────────────────────────────────────────────────

const PHASE_META: Record<
  GamePhase,
  { label: string; icon: string; textColor: string; bg: string; border: string; glow: string }
> = {
  [GamePhase.RECON]: {
    label: 'RECON',
    icon: '🔭',
    textColor: 'text-indigo-300',
    bg: 'bg-indigo-950',
    border: 'border-indigo-400',
    glow: '0 0 120px rgba(99,102,241,0.5)',
  },
  [GamePhase.MANIPULATION]: {
    label: 'MANIPULATION',
    icon: '🎭',
    textColor: 'text-yellow-300',
    bg: 'bg-yellow-950',
    border: 'border-yellow-400',
    glow: '0 0 120px rgba(234,179,8,0.5)',
  },
  [GamePhase.OBJECTIVE]: {
    label: 'OBJECTIVE',
    icon: '🎯',
    textColor: 'text-green-300',
    bg: 'bg-green-950',
    border: 'border-green-400',
    glow: '0 0 120px rgba(34,197,94,0.5)',
  },
  [GamePhase.AND_OR_EVENTS]: {
    label: 'EVENTS',
    icon: '⚡',
    textColor: 'text-purple-300',
    bg: 'bg-purple-950',
    border: 'border-purple-400',
    glow: '0 0 120px rgba(168,85,247,0.5)',
  },
  [GamePhase.COLLAPSE]: {
    label: 'COLLAPSE',
    icon: '🔒',
    textColor: 'text-red-300',
    bg: 'bg-red-950',
    border: 'border-red-400',
    glow: '0 0 120px rgba(239,68,68,0.5)',
  },
};

const WIN_CONDITION_TEXT: Record<string, string> = {
  objectives_completed: 'Ghost completed 3+ objectives and survived!',
  ghost_locked:         "Seeker locked the Ghost's position!",
  ghost_survived:       'Ghost survived but captured fewer than 3 objectives.',
};

const WIN_CONDITION_ICON: Record<string, string> = {
  objectives_completed: '🎯',
  ghost_locked:         '🔒',
  ghost_survived:       '❌',
};

// ─── Auto-dismiss durations ───────────────────────────────────────────────────
const PHASE_END_DURATION = 2500;
const CYCLE_END_DURATION = 4000;
const ROUND_END_DURATION = 6000;

/**
 * BannerOverlay — large full-screen centred banners that cover the grid.
 *
 * phase_end  → full-screen phase colour overlay, 2.5s
 * cycle_end  → full-screen cyan overlay, 4s
 * round_end  → full-screen win/loss overlay, 6s (click to dismiss early)
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

  // ── Phase end ─────────────────────────────────────────────────────────────
  if (banner.type === 'phase_end' && banner.phase) {
    const meta = PHASE_META[banner.phase];
    const roleLabel = banner.humanRole === GameRole.GHOST ? '👻 Ghost' : '🔍 Seeker';

    return (
      <Backdrop onClick={dismissBanner} bg="rgba(0,0,0,0.82)">
        <div
          className={`
            w-full max-w-2xl mx-4 rounded-3xl border-4 px-12 py-14 text-center font-mono
            ${meta.bg} ${meta.border} ${meta.textColor}
          `}
          style={{ boxShadow: meta.glow, animation: 'scaleIn 0.3s ease-out' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Big icon */}
          <div className="text-8xl mb-6">{meta.icon}</div>

          {/* Phase name */}
          <div className="text-6xl font-black tracking-widest mb-3 uppercase">
            {meta.label}
          </div>

          <div className="text-2xl font-bold opacity-70 mb-6 uppercase tracking-widest">
            PHASE ENDED
          </div>

          {/* Divider */}
          <div className="w-24 h-1 rounded-full bg-current opacity-30 mx-auto mb-6" />

          {/* Role pill */}
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border-2 border-current bg-black/30 text-xl font-bold">
            <span className="opacity-60 text-base">You are</span>
            {roleLabel}
          </div>

          <div className="mt-8 text-sm opacity-30 tracking-widest uppercase">
            Next phase starting…
          </div>
        </div>
        <BannerStyles />
      </Backdrop>
    );
  }

  // ── Cycle end ─────────────────────────────────────────────────────────────
  if (banner.type === 'cycle_end') {
    const roleLabel = banner.humanRole === GameRole.GHOST ? '👻 Ghost' : '🔍 Seeker';
    const cycleNum  = banner.cycleNumber ?? 1;

    return (
      <Backdrop onClick={dismissBanner} bg="rgba(0,0,0,0.85)">
        <div
          className="w-full max-w-2xl mx-4 rounded-3xl border-4 px-12 py-14 text-center font-mono
            bg-gray-950 border-cyan-400 text-cyan-300"
          style={{ boxShadow: '0 0 140px rgba(0,220,255,0.4)', animation: 'scaleIn 0.3s ease-out' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Big icon */}
          <div className="text-8xl mb-6">🔄</div>

          {/* Cycle number */}
          <div className="text-6xl font-black tracking-widest mb-3">
            CYCLE {cycleNum}
          </div>
          <div className="text-3xl font-bold opacity-70 mb-6 uppercase tracking-widest">
            COMPLETE
          </div>

          {/* Divider */}
          <div className="w-24 h-1 rounded-full bg-cyan-400 opacity-40 mx-auto mb-6" />

          {/* Info row */}
          <div className="flex items-center justify-center gap-6 text-lg mb-6">
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl">⚔️</span>
              <span className="text-sm opacity-60 uppercase tracking-wider">Round continues</span>
              <span className="font-bold">Cycle {cycleNum + 1} of 2</span>
            </div>
            <div className="w-px h-16 bg-cyan-700" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl">🔋</span>
              <span className="text-sm opacity-60 uppercase tracking-wider">AP Reset</span>
              <span className="font-bold">Belief Diffused</span>
            </div>
          </div>

          {/* Role pill */}
          <div className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-full border-2 text-xl font-bold ${
            banner.humanRole === GameRole.GHOST
              ? 'border-green-500 bg-green-950/60 text-green-300'
              : 'border-blue-500 bg-blue-950/60 text-blue-300'
          }`}>
            <span className="opacity-60 text-base">Your role:</span>
            {roleLabel}
          </div>

          <div className="mt-8 text-sm opacity-30 tracking-widest uppercase">
            Continuing…
          </div>
        </div>
        <BannerStyles />
      </Backdrop>
    );
  }

  // ── Round end ─────────────────────────────────────────────────────────────
  if (banner.type === 'round_end') {
    const humanWon   = banner.humanWon ?? false;
    const roleLabel  = banner.humanRole === GameRole.GHOST ? '👻 Ghost' : '🔍 Seeker';
    const winnerRole = banner.winner === GameRole.GHOST ? '👻 Ghost' : '🔍 Seeker';
    const wcText     = WIN_CONDITION_TEXT[banner.winCondition ?? ''] ?? '';
    const wcIcon     = WIN_CONDITION_ICON[banner.winCondition ?? ''] ?? '•';
    const humanWins  = banner.humanWins ?? 0;
    const aiWins     = banner.aiWins ?? 0;

    return (
      <Backdrop onClick={dismissBanner} bg={humanWon ? 'rgba(20,15,0,0.90)' : 'rgba(0,0,0,0.90)'}>
        <div
          className={`
            w-full max-w-2xl mx-4 rounded-3xl border-4 px-12 py-14 text-center font-mono
            ${humanWon
              ? 'bg-yellow-950 border-yellow-400 text-yellow-300'
              : 'bg-gray-950 border-gray-600 text-gray-300'
            }
          `}
          style={{
            boxShadow: humanWon
              ? '0 0 160px rgba(255,200,0,0.35)'
              : '0 0 80px rgba(0,0,0,0.9)',
            animation: 'scaleIn 0.35s ease-out',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Trophy / skull */}
          <div className="text-8xl mb-4">{humanWon ? '🏆' : '💀'}</div>

          {/* Win / Loss */}
          <div className={`text-6xl font-black tracking-widest mb-2 ${humanWon ? 'text-yellow-400' : 'text-gray-400'}`}>
            {humanWon ? 'ROUND WON!' : 'ROUND LOST'}
          </div>

          {/* Round number */}
          <div className="text-xl opacity-50 mb-6 uppercase tracking-widest">
            Round {banner.round} complete
          </div>

          {/* Divider */}
          <div className={`w-24 h-1 rounded-full mx-auto mb-6 ${humanWon ? 'bg-yellow-400' : 'bg-gray-600'} opacity-50`} />

          {/* Role + winner row */}
          <div className="flex items-center justify-center gap-8 mb-6 text-lg">
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm opacity-50 uppercase tracking-wider">You played</span>
              <span className={`font-bold text-xl px-4 py-1.5 rounded-full border-2 ${
                banner.humanRole === GameRole.GHOST
                  ? 'text-green-400 border-green-600 bg-green-950/60'
                  : 'text-blue-400 border-blue-600 bg-blue-950/60'
              }`}>
                {roleLabel}
              </span>
            </div>
            <div className="text-3xl opacity-30">|</div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm opacity-50 uppercase tracking-wider">Winner</span>
              <span className="font-bold text-xl">{winnerRole}</span>
            </div>
          </div>

          {/* Win condition */}
          <div className={`text-base px-5 py-3 rounded-xl mb-6 border ${
            humanWon
              ? 'bg-yellow-900/40 border-yellow-700 text-yellow-200'
              : 'bg-gray-800/60 border-gray-700 text-gray-400'
          }`}>
            <div className="font-bold text-lg mb-1">{wcIcon} {wcText}</div>
            {banner.winCondition !== 'ghost_locked' && (
              <div className="text-sm opacity-70">
                Objectives captured: <span className="font-bold">{banner.objectivesCompleted} / 5</span>
                <span className="ml-2 opacity-60">(need 3 to win)</span>
              </div>
            )}
          </div>

          {/* Score */}
          <div className="flex items-center justify-center gap-10 mb-6">
            <div className="flex flex-col items-center">
              <span className="text-sm opacity-50 mb-1 uppercase tracking-wider">You</span>
              <span className={`text-5xl font-black ${humanWon ? 'text-yellow-400' : 'text-gray-500'}`}>
                {humanWins}
              </span>
              <div className="flex gap-1.5 mt-2">
                {[0, 1].map(i => (
                  <div key={i} className={`w-5 h-5 rounded border-2 ${
                    i < humanWins ? 'bg-yellow-400 border-yellow-300' : 'bg-gray-800 border-gray-600'
                  }`} />
                ))}
              </div>
            </div>
            <span className="text-gray-600 text-4xl font-black">vs</span>
            <div className="flex flex-col items-center">
              <span className="text-sm opacity-50 mb-1 uppercase tracking-wider">AI</span>
              <span className={`text-5xl font-black ${!humanWon ? 'text-red-400' : 'text-gray-500'}`}>
                {aiWins}
              </span>
              <div className="flex gap-1.5 mt-2">
                {[0, 1].map(i => (
                  <div key={i} className={`w-5 h-5 rounded border-2 ${
                    i < aiWins ? 'bg-red-500 border-red-400' : 'bg-gray-800 border-gray-600'
                  }`} />
                ))}
              </div>
            </div>
          </div>

          {/* Dismiss hint */}
          <div className="text-sm opacity-25 tracking-widest uppercase">
            Click anywhere or wait to continue…
          </div>
        </div>
        <BannerStyles />
      </Backdrop>
    );
  }

  return null;
};

// ─── Shared backdrop wrapper ──────────────────────────────────────────────────

const Backdrop: React.FC<{
  children: React.ReactNode;
  bg: string;
  onClick: () => void;
}> = ({ children, bg, onClick }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center"
    style={{ background: bg, animation: 'fadeIn 0.2s ease-out' }}
    onClick={onClick}
  >
    {children}
  </div>
);

// ─── Keyframes ────────────────────────────────────────────────────────────────

const BannerStyles: React.FC = () => (
  <style>{`
    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes scaleIn {
      from { transform: scale(0.88) translateY(-16px); opacity: 0; }
      to   { transform: scale(1)    translateY(0);     opacity: 1; }
    }
  `}</style>
);
