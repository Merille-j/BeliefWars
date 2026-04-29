import React from 'react';
import { useGameStore } from '../store/gameStore';

/**
 * Best-of-3 round display.
 * Shows win indicators for YOU vs AI (player-based, not role-based).
 */
export const RoundTracker: React.FC = () => {
  const { humanWins, aiWins, currentRound } = useGameStore();

  return (
    <div className="flex items-center gap-4 font-mono text-sm">
      {/* Human wins */}
      <div className="flex items-center gap-1">
        <span className="text-yellow-400 text-xs">YOU</span>
        <div className="flex gap-1">
          {[0, 1].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-sm border ${
                i < humanWins
                  ? 'bg-yellow-400 border-yellow-300'
                  : 'bg-gray-800 border-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Round number */}
      <div className="flex flex-col items-center">
        <span className="text-gray-500 text-xs">ROUND</span>
        <span className="text-white font-bold text-lg leading-none">{currentRound}</span>
      </div>

      {/* AI wins */}
      <div className="flex items-center gap-1">
        <div className="flex gap-1">
          {[0, 1].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-sm border ${
                i < aiWins
                  ? 'bg-red-500 border-red-400'
                  : 'bg-gray-800 border-gray-600'
              }`}
            />
          ))}
        </div>
        <span className="text-red-400 text-xs">AI</span>
      </div>
    </div>
  );
};
