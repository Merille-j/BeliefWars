import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { GameRole, GamePhase, MoveRecord, RoundHistoryEntry } from '../types/client.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const WIN_CONDITION: Record<string, { label: string; icon: string; color: string }> = {
  objectives_completed:     { label: 'Ghost: 3+ objectives + survived', icon: '🎯', color: 'text-green-400'  },
  all_objectives_completed: { label: 'Ghost: ALL objectives + survived', icon: '🏅', color: 'text-yellow-400' },
  ghost_locked:             { label: 'Seeker: Ghost locked',             icon: '🔒', color: 'text-red-400'   },
  ghost_survived:           { label: 'Seeker: Ghost had <3 objectives',  icon: '❌', color: 'text-red-400'   },
};

const PHASE_COLOR: Record<string, string> = {
  RECON:         'text-indigo-400',
  MANIPULATION:  'text-yellow-400',
  OBJECTIVE:     'text-green-400',
  AND_OR_EVENTS: 'text-purple-400',
  COLLAPSE:      'text-red-400',
};

const ACTION_ICON: Record<string, string> = {
  THROW_DECOY:        '🎯',
  MAKE_NOISE:         '📢',
  LAY_FALSE_TRAIL:    '👣',
  MOVE:               '🚶',
  COMPLETE_OBJECTIVE: '✅',
  SCAN:               '📡',
  LOCK:               '🔒',
  END_PHASE:          '⏭',
};

// ─── Move timeline row ────────────────────────────────────────────────────────

const MoveRow: React.FC<{ move: MoveRecord; isHuman: boolean }> = ({ move, isHuman }) => {
  const icon = ACTION_ICON[move.actionType] ?? '•';
  const phaseColor = PHASE_COLOR[move.phase] ?? 'text-gray-400';
  const actorColor = isHuman ? 'text-yellow-300' : 'text-gray-400';
  const roleColor  = move.role === GameRole.GHOST ? 'text-green-400' : 'text-blue-400';

  return (
    <div className={`flex items-start gap-2 py-0.5 text-xs ${isHuman ? 'bg-yellow-950/20' : ''} rounded px-1`}>
      {/* Actor indicator */}
      <span className={`w-10 shrink-0 font-bold ${actorColor}`}>
        {isHuman ? 'YOU' : 'AI'}
      </span>

      {/* Role */}
      <span className={`w-14 shrink-0 font-bold ${roleColor}`}>
        {move.role === GameRole.GHOST ? '👻' : '🔍'} {move.role === GameRole.GHOST ? 'Ghost' : 'Seeker'}
      </span>

      {/* Phase */}
      <span className={`w-20 shrink-0 ${phaseColor} opacity-70`}>
        {move.phase.replace('_', ' ')}
      </span>

      {/* Action */}
      <span className="flex-1 text-gray-300">
        {icon} {move.detail ?? `${move.actionType}${move.x !== undefined ? ` (${move.x},${move.y})` : ''}`}
      </span>
    </div>
  );
};

// ─── Round card (expandable) ──────────────────────────────────────────────────

const RoundCard: React.FC<{ entry: RoundHistoryEntry; defaultOpen?: boolean }> = ({ entry, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const wc = WIN_CONDITION[entry.winCondition];

  // Group moves by phase for cleaner display
  const phases = [GamePhase.RECON, GamePhase.MANIPULATION, GamePhase.OBJECTIVE, GamePhase.AND_OR_EVENTS, GamePhase.COLLAPSE];
  const movesByPhase: Record<string, MoveRecord[]> = {};
  for (const phase of phases) {
    const phaseMoves = entry.moves.filter(m => m.phase === phase);
    if (phaseMoves.length > 0) movesByPhase[phase] = phaseMoves;
  }

  return (
    <div className={`rounded-lg border font-mono ${entry.humanWon ? 'border-yellow-700 bg-yellow-950/20' : 'border-gray-700 bg-gray-800/40'}`}>
      {/* Header — always visible */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-300 font-bold text-sm">Round {entry.round}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${entry.humanWon ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-400'}`}>
            {entry.humanWon ? '🏆 WIN' : '💀 LOSS'}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          {/* Roles */}
          <span className={entry.humanRole === GameRole.GHOST ? 'text-green-400' : 'text-blue-400'}>
            You: {entry.humanRole === GameRole.GHOST ? '👻 Ghost' : '🔍 Seeker'}
          </span>
          {/* Win condition */}
          <span className={wc.color}>{wc.icon} {wc.label}</span>
          {/* Objectives */}
          <span className="text-yellow-400">{entry.objectivesCompleted}/3 obj</span>
          {/* Move count */}
          <span className="text-gray-500">{entry.moves.length} moves</span>
          {/* Expand toggle */}
          <span className="text-gray-500 text-base">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Move timeline — shown when expanded */}
      {open && (
        <div className="border-t border-gray-700 px-4 py-3">
          {entry.moves.length === 0 ? (
            <p className="text-gray-600 text-xs italic">No moves recorded this round.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {/* Column headers */}
              <div className="flex items-center gap-2 text-xs text-gray-600 mb-1 px-1">
                <span className="w-10">Actor</span>
                <span className="w-14">Role</span>
                <span className="w-20">Phase</span>
                <span className="flex-1">Action</span>
              </div>

              {/* Group by phase with phase dividers */}
              {phases.map(phase => {
                const phaseMoves = movesByPhase[phase];
                if (!phaseMoves) return null;
                const phaseColor = PHASE_COLOR[phase] ?? 'text-gray-400';
                return (
                  <div key={phase} className="mb-2">
                    <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${phaseColor} opacity-60`}>
                      — {phase.replace('_', ' ')} —
                    </div>
                    {phaseMoves.map((move, i) => (
                      <MoveRow
                        key={`${phase}-${move.actor}-${move.actionType}-${i}`}
                        move={move}
                        isHuman={move.actor === 'human'}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface RoundHistoryProps {
  variant?: 'compact' | 'full';
}

export const RoundHistory: React.FC<RoundHistoryProps> = ({ variant = 'compact' }) => {
  const { roundHistory } = useGameStore();

  if (roundHistory.length === 0) return null;

  // Compact: sidebar during game — just summary rows, no move detail
  if (variant === 'compact') {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 font-mono">
        <h3 className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-2">
          Rounds Played
        </h3>
        <div className="flex flex-col gap-1.5">
          {roundHistory.map((entry) => {
            const wc = WIN_CONDITION[entry.winCondition];
            return (
              <div
                key={entry.round}
                className={`flex items-center justify-between text-xs rounded px-2 py-1.5 ${
                  entry.humanWon
                    ? 'bg-yellow-950/50 border border-yellow-800'
                    : 'bg-gray-800 border border-gray-700'
                }`}
              >
                <span className="text-gray-500 w-8 shrink-0">R{entry.round}</span>
                <span className={`w-16 shrink-0 font-bold ${entry.humanRole === GameRole.GHOST ? 'text-green-400' : 'text-blue-400'}`}>
                  {entry.humanRole === GameRole.GHOST ? '👻 Ghost' : '🔍 Seeker'}
                </span>
                <span className={`flex-1 text-center ${wc.color}`}>{wc.icon} {wc.label}</span>
                <span className={`w-12 text-right font-bold ${entry.humanWon ? 'text-yellow-400' : 'text-red-400'}`}>
                  {entry.humanWon ? 'WIN' : 'LOSS'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Full: result screen — expandable round cards with full move timeline
  return (
    <div className="font-mono mb-6">
      <h3 className="text-gray-300 text-sm font-bold uppercase tracking-wider mb-3">
        Match Replay — Round by Round
      </h3>
      <p className="text-gray-500 text-xs mb-4">
        Click any round to expand the full move-by-move log.
      </p>
      <div className="flex flex-col gap-3">
        {roundHistory.map((entry, i) => (
          <RoundCard
            key={entry.round}
            entry={entry}
            defaultOpen={i === roundHistory.length - 1} // last round open by default
          />
        ))}
      </div>
    </div>
  );
};
