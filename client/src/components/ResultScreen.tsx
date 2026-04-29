import React from 'react';
import { useGameStore } from '../store/gameStore';
import { selectHumanRole } from '../store/gameStore';
import { GameRole } from '../types/client.types';
import { RoundHistory } from './RoundHistory';

interface ResultScreenProps {
  onPlayAgain: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({ onPlayAgain }) => {
  const { matchWinner, ghostWins, seekerWins, humanWins, aiWins } = useGameStore();
  const humanRole = useGameStore(selectHumanRole);

  const humanWon = humanWins >= 2;
  const isGhostWinner = matchWinner === GameRole.GHOST;

  return (
    <div className="min-h-screen bg-gray-950 font-mono overflow-y-auto">
      {/* Background glow */}
      <div
        className="fixed inset-0 pointer-events-none opacity-10"
        style={{
          background: humanWon
            ? 'radial-gradient(circle at center, rgba(255,221,0,0.4) 0%, transparent 70%)'
            : 'radial-gradient(circle at center, rgba(255,50,50,0.3) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-start min-h-screen px-4 py-10 sm:py-16">
        <div className="w-full max-w-lg text-center">

          {/* ── Verdict ───────────────────────────────────────────────────── */}
          <div className="mb-6 sm:mb-8">
            <div className="text-5xl sm:text-6xl mb-3">{humanWon ? '🏆' : '💀'}</div>
            <div className={`text-4xl sm:text-5xl font-black tracking-widest mb-2 ${humanWon ? 'text-yellow-400' : 'text-gray-400'}`}>
              {humanWon ? 'VICTORY!' : 'DEFEAT'}
            </div>
            <div className={`text-base sm:text-lg font-bold ${isGhostWinner ? 'text-green-400' : 'text-blue-400'}`}>
              {isGhostWinner ? '👻 Ghost' : '🔍 Seeker'} role wins the match
            </div>
          </div>

          {/* ── Player score ──────────────────────────────────────────────── */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 sm:p-6 mb-4">
            <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-4">Match Score</h3>
            <div className="flex items-center justify-center gap-8 sm:gap-10">
              <div className="flex flex-col items-center">
                <span className="text-gray-300 text-xs mb-1">YOU</span>
                <span className={`text-4xl sm:text-5xl font-black ${humanWon ? 'text-yellow-400' : 'text-gray-500'}`}>
                  {humanWins}
                </span>
                <div className="flex gap-1 mt-2">
                  {[0, 1].map(i => (
                    <div key={i} className={`w-5 h-5 rounded border ${i < humanWins ? 'bg-yellow-400 border-yellow-300' : 'bg-gray-800 border-gray-600'}`} />
                  ))}
                </div>
              </div>
              <div className="text-gray-600 text-2xl sm:text-3xl font-bold">vs</div>
              <div className="flex flex-col items-center">
                <span className="text-gray-300 text-xs mb-1">AI</span>
                <span className={`text-4xl sm:text-5xl font-black ${!humanWon ? 'text-red-400' : 'text-gray-500'}`}>
                  {aiWins}
                </span>
                <div className="flex gap-1 mt-2">
                  {[0, 1].map(i => (
                    <div key={i} className={`w-5 h-5 rounded border ${i < aiWins ? 'bg-red-500 border-red-400' : 'bg-gray-800 border-gray-600'}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Role breakdown ────────────────────────────────────────────── */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 mb-5">
            <h3 className="text-gray-500 text-xs uppercase tracking-wider mb-3">Role Wins Breakdown</h3>
            <div className="flex items-center justify-center gap-6 sm:gap-8">
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-xs">👻 Ghost</span>
                <span className="text-green-400 font-bold text-lg">{ghostWins}</span>
              </div>
              <div className="text-gray-700">|</div>
              <div className="flex items-center gap-2">
                <span className="text-blue-400 text-xs">🔍 Seeker</span>
                <span className="text-blue-400 font-bold text-lg">{seekerWins}</span>
              </div>
            </div>
          </div>

          {/* ── Role summary ──────────────────────────────────────────────── */}
          <div className={`mb-7 p-4 rounded-lg border text-sm ${humanWon ? 'bg-yellow-950 border-yellow-700 text-yellow-300' : 'bg-gray-900 border-gray-700 text-gray-400'}`}>
            {humanRole ? (
              <p>
                Your final role was{' '}
                <span className={humanRole === GameRole.GHOST ? 'text-green-400 font-bold' : 'text-blue-400 font-bold'}>
                  {humanRole === GameRole.GHOST ? '👻 Ghost' : '🔍 Seeker'}
                </span>
                {'. '}You{' '}
                <span className={humanWon ? 'text-yellow-400 font-bold' : 'text-red-400 font-bold'}>
                  {humanWon ? 'won' : 'lost'}
                </span>
                {' '}the match {humanWins}–{aiWins}.
              </p>
            ) : (
              <p>Match complete — {humanWon ? 'you won!' : 'AI wins.'}</p>
            )}
          </div>

          {/* ── Round History ─────────────────────────────────────────────── */}
          <RoundHistory variant="full" />

          {/* ── Play again ────────────────────────────────────────────────── */}
          <button
            className="w-full sm:w-auto px-8 sm:px-12 py-3 sm:py-4 text-lg sm:text-xl font-black tracking-widest uppercase
              bg-green-500 hover:bg-green-400 text-black rounded-lg transition-all duration-200
              hover:scale-105 active:scale-95 mb-8"
            onClick={onPlayAgain}
            style={{ boxShadow: '0 0 30px rgba(0,255,136,0.3)' }}
          >
            PLAY AGAIN
          </button>

        </div>
      </div>
    </div>
  );
};
