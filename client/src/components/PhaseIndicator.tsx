import React, { useState } from 'react';
import { GamePhase } from '../types/client.types';
import { useGameStore } from '../store/gameStore';

const PHASES: Array<{
  phase: GamePhase;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  activeColor: string;
  timerColor: string;
}> = [
  {
    phase: GamePhase.RECON,
    label: 'Recon',
    shortLabel: 'RCN',
    description: 'Observe the map and plan your strategy.',
    color: 'bg-indigo-900 border-indigo-700 text-indigo-400',
    activeColor: 'bg-indigo-600 border-indigo-400 text-white',
    timerColor: '#818cf8',
  },
  {
    phase: GamePhase.MANIPULATION,
    label: 'Manipulation',
    shortLabel: 'MNP',
    description: 'Ghost uses decoys, noise, and false trails.',
    color: 'bg-yellow-900 border-yellow-700 text-yellow-400',
    activeColor: 'bg-yellow-600 border-yellow-400 text-white',
    timerColor: '#fbbf24',
  },
  {
    phase: GamePhase.OBJECTIVE,
    label: 'Objective',
    shortLabel: 'OBJ',
    description: 'Ghost moves and completes objectives.',
    color: 'bg-green-900 border-green-700 text-green-400',
    activeColor: 'bg-green-600 border-green-400 text-white',
    timerColor: '#34d399',
  },
  {
    phase: GamePhase.AND_OR_EVENTS,
    label: 'Events',
    shortLabel: 'EVT',
    description: 'Nondeterministic events and contingency plans.',
    color: 'bg-purple-900 border-purple-700 text-purple-400',
    activeColor: 'bg-purple-600 border-purple-400 text-white',
    timerColor: '#a78bfa',
  },
  {
    phase: GamePhase.COLLAPSE,
    label: 'Collapse',
    shortLabel: 'COL',
    description: 'Seeker scans and locks to find the Ghost.',
    color: 'bg-red-900 border-red-700 text-red-400',
    activeColor: 'bg-red-600 border-red-400 text-white',
    timerColor: '#f87171',
  },
];

export const PhaseIndicator: React.FC = () => {
  const { gameState, phaseTimeRemaining, phaseDuration, cyclesCompleted, cyclesPerRound } = useGameStore();
  const currentPhase = gameState?.phase ?? GamePhase.RECON;
  const [hoveredPhase, setHoveredPhase] = useState<GamePhase | null>(null);

  const currentIndex = PHASES.findIndex(p => p.phase === currentPhase);
  const activePhaseInfo = PHASES[currentIndex];

  const isUrgent = phaseTimeRemaining <= 5;
  const progress = phaseDuration > 0 ? phaseTimeRemaining / phaseDuration : 0;
  // Which cycle are we currently in? cyclesCompleted = completed cycles, so current = cyclesCompleted + 1
  const currentCycle = cyclesCompleted + 1;

  return (
    <div className="flex flex-col gap-0.5">
      {/* Phase steps + timer */}
      <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
        {PHASES.map((p, i) => {
          const isActive = p.phase === currentPhase;
          const isPast = i < currentIndex;
          return (
            <React.Fragment key={p.phase}>
              <div
                className={`
                  relative flex items-center justify-center flex-shrink-0
                  border rounded px-1.5 sm:px-2 py-0.5 sm:py-1
                  text-xs font-bold font-mono whitespace-nowrap
                  transition-all duration-200 cursor-default
                  ${isActive ? p.activeColor : p.color}
                  ${isPast ? 'opacity-60' : ''}
                  ${isActive ? 'ring-1 ring-white/30' : ''}
                `}
                onMouseEnter={() => setHoveredPhase(p.phase)}
                onMouseLeave={() => setHoveredPhase(null)}
              >
                {isActive && <span className="mr-0.5 animate-pulse text-xs">▶</span>}
                {isPast   && <span className="mr-0.5 text-xs">✓</span>}
                <span className="sm:hidden">{p.shortLabel}</span>
                <span className="hidden sm:inline">{p.label}</span>
              </div>
              {i < PHASES.length - 1 && (
                <div className={`flex-1 h-px min-w-[4px] ${i < currentIndex ? 'bg-gray-400' : 'bg-gray-700'}`} />
              )}
            </React.Fragment>
          );
        })}

        {/* Timer badge + cycle counter */}
        <div className="flex-shrink-0 ml-1 sm:ml-2 flex items-center gap-2">
          {/* Cycle indicator */}
          <div className="flex items-center gap-0.5 text-xs font-mono">
            {Array.from({ length: cyclesPerRound }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full border ${
                  i < cyclesCompleted
                    ? 'bg-gray-400 border-gray-400'
                    : i === cyclesCompleted
                    ? 'bg-white border-white animate-pulse'
                    : 'bg-transparent border-gray-600'
                }`}
                title={`Cycle ${i + 1} of ${cyclesPerRound}`}
              />
            ))}
            <span className="text-gray-500 ml-0.5 text-xs">C{currentCycle}/{cyclesPerRound}</span>
          </div>

          {/* Countdown */}
          <div
            className={`font-mono font-black text-sm sm:text-base tabular-nums leading-none transition-colors duration-300 ${isUrgent ? 'text-red-400 animate-pulse' : ''}`}
            style={{ color: isUrgent ? undefined : activePhaseInfo?.timerColor }}
          >
            {phaseTimeRemaining >= 60
              ? `${Math.floor(phaseTimeRemaining / 60)}:${String(phaseTimeRemaining % 60).padStart(2, '0')}`
              : `${String(phaseTimeRemaining).padStart(2, '0')}s`}
          </div>
        </div>
      </div>

      {/* Progress bar — drains left to right */}
      <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress * 100}%`,
            backgroundColor: isUrgent
              ? '#ef4444'
              : activePhaseInfo?.timerColor ?? '#6b7280',
          }}
        />
      </div>

      {/* Hover description */}
      {hoveredPhase && (
        <div className="text-xs text-gray-400 truncate">
          {PHASES.find(p => p.phase === hoveredPhase)?.description}
        </div>
      )}
    </div>
  );
};
