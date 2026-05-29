import React from 'react';
import { useGameStore } from '../store/gameStore';
import { selectHumanRole, selectSeekerAP, selectGhostAP } from '../store/gameStore';
import { GameRole, GamePhase } from '../types/client.types';

const PHASE_COLORS: Record<GamePhase, string> = {
  [GamePhase.RECON]: 'text-indigo-400 border-indigo-400',
  [GamePhase.MANIPULATION]: 'text-yellow-400 border-yellow-400',
  [GamePhase.OBJECTIVE]: 'text-green-400 border-green-400',
  [GamePhase.AND_OR_EVENTS]: 'text-purple-400 border-purple-400',
  [GamePhase.COLLAPSE]: 'text-red-400 border-red-400',
};

const PHASE_DESCRIPTIONS: Record<GamePhase, string> = {
  [GamePhase.RECON]: 'Observe the map and plan your strategy.',
  [GamePhase.MANIPULATION]: 'Use decoys, noise, and false trails to mislead.',
  [GamePhase.OBJECTIVE]: 'Move across the grid and complete objectives.',
  [GamePhase.AND_OR_EVENTS]: 'Nondeterministic events — contingency plans activate.',
  [GamePhase.COLLAPSE]: 'Seeker: scan zones and lock onto the Ghost.',
};

/**
 * Player information display panel.
 * Shows role, round, score, AP, and current phase.
 */
export const GameHUD: React.FC = () => {
  const {
    gameState,
    humanWins,
    aiWins,
    currentRound,
    entities,
  } = useGameStore();
  const humanRole = useGameStore(selectHumanRole);
  const seekerAP = useGameStore(selectSeekerAP);
  const ghostAP = useGameStore(selectGhostAP);

  const phase = gameState?.phase ?? GamePhase.RECON;
  const phaseColor = PHASE_COLORS[phase];
  const phaseDesc = PHASE_DESCRIPTIONS[phase];

  const objectives = gameState?.objectives ?? [];
  const completedCount = objectives.filter(o => o.completed).length;

  const seekerEntity = entities.find(e => e.role === GameRole.SEEKER);
  const ghostEntity = entities.find(e => e.role === GameRole.GHOST);

  return (
    <div className="flex flex-col gap-3 p-4 bg-gray-900 rounded-lg border border-gray-700 font-mono text-sm">

      {/* Role Badge */}
      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-xs uppercase tracking-wider">Your Role</span>
        {humanRole === GameRole.GHOST ? (
          <span className="px-3 py-1 rounded-full bg-green-900 text-green-400 border border-green-600 font-bold text-xs">
            👻 GHOST
          </span>
        ) : humanRole === GameRole.SEEKER ? (
          <span className="px-3 py-1 rounded-full bg-blue-900 text-blue-400 border border-blue-600 font-bold text-xs">
            🔍 SEEKER
          </span>
        ) : (
          <span className="px-3 py-1 rounded-full bg-gray-800 text-gray-400 border border-gray-600 text-xs">
            —
          </span>
        )}
      </div>

      {/* Round Indicator */}
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-xs uppercase tracking-wider">Round</span>
        <span className="text-white font-bold">{currentRound} / 3</span>
      </div>

      {/* Score — You vs AI (player-based, role-independent) */}
      <div className="flex items-center justify-between bg-gray-800 rounded p-2">
        <div className="flex flex-col items-center">
          <span className="text-yellow-400 text-xs">YOU</span>
          <span className="text-yellow-400 font-bold text-xl">{humanWins}</span>
        </div>
        <span className="text-gray-500 text-lg font-bold">vs</span>
        <div className="flex flex-col items-center">
          <span className="text-red-400 text-xs">AI</span>
          <span className="text-red-400 font-bold text-xl">{aiWins}</span>
        </div>
      </div>

      {/* Seeker AP Bar */}
      {humanRole === GameRole.SEEKER && (
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Action Points</span>
            <span className="text-blue-400 font-bold">{seekerAP} / 10</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="bg-blue-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${(seekerAP / 10) * 100}%` }}
            />
          </div>
          <div className="flex gap-2 mt-1 text-xs text-gray-500">
            <span>Scan: 2 AP</span>
            <span>Lock: 4 AP</span>
          </div>
        </div>
      )}

      {/* Ghost AP Bar */}
      {humanRole === GameRole.GHOST && (
        <div>
          {phase === GamePhase.OBJECTIVE ? (
            <>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Move Points</span>
                <span className="text-green-400 font-bold">{ghostAP} / 8</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(ghostAP / 8) * 100}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-gray-500">1 AP per adjacent step (↑↓←→)</div>
            </>
          ) : (
            <>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Action Points</span>
                <span className="text-green-400 font-bold">{ghostAP} / 8</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(ghostAP / 8) * 100}%` }}
                />
              </div>
              <div className="flex gap-2 mt-1 text-xs text-gray-500">
                <span>Decoy: 2 AP</span>
                <span>Noise: 2 AP</span>
                <span>Trail: 3 AP</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Ghost Objectives */}
      {humanRole === GameRole.GHOST && (
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Objectives</span>
            <span className={`font-bold ${completedCount >= 3 ? 'text-green-400' : 'text-yellow-400'}`}>
              {completedCount} / {objectives.length}
              {completedCount >= 3 && <span className="ml-1 text-green-300">✓ WIN</span>}
            </span>
          </div>
          {/* Threshold marker at 3 objectives */}
          <div className="relative flex gap-1 mb-1">
            {objectives.map((obj) => (
              <div
                key={obj.id}
                className={`flex-1 h-3 rounded transition-all duration-300 ${
                  obj.completed ? 'bg-green-500' : 'bg-gray-700 border border-yellow-600'
                }`}
                title={`${obj.label}: ${obj.completed ? 'Completed' : `(${obj.position.x}, ${obj.position.y})`}`}
              />
            ))}
            {/* Win threshold marker after 3rd bar */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-green-400 opacity-70"
              style={{ left: `calc(${(3 / objectives.length) * 100}% - 1px)` }}
              title="Win threshold: 3 objectives"
            />
          </div>
          <div className="text-xs text-gray-500 mb-1">
            Complete <span className="text-green-400 font-bold">3 of 5</span> objectives
            <span className="text-gray-600"> + survive both Collapses</span>
          </div>
          <div className="flex flex-wrap gap-x-2 text-xs text-gray-500">
            {objectives.map(obj => (
              <span key={obj.id} className={obj.completed ? 'text-green-400 line-through' : 'text-yellow-400'}>
                {obj.label}({obj.position.x},{obj.position.y})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Current Phase */}
      <div className={`border rounded p-2 ${phaseColor}`}>
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-2 h-2 rounded-full bg-current animate-pulse`} />
          <span className="font-bold text-xs uppercase tracking-wider">{phase}</span>
        </div>
        <p className="text-gray-400 text-xs leading-relaxed">{phaseDesc}</p>
      </div>

      {/* Alert Level */}
      {gameState && gameState.alertLevel > 0 && (
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Alert Level</span>
            <span className={`font-bold ${gameState.alertLevel > 75 ? 'text-red-400' : 'text-yellow-400'}`}>
              {gameState.alertLevel}%
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                gameState.alertLevel > 75 ? 'bg-red-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${gameState.alertLevel}%` }}
            />
          </div>
        </div>
      )}

      {/* Entity Positions — only shown to the relevant player */}
      <div className="text-xs text-gray-600 border-t border-gray-800 pt-2">
        {ghostEntity && humanRole === GameRole.GHOST && (
          <div>Ghost: ({ghostEntity.position.x}, {ghostEntity.position.y})</div>
        )}
        {seekerEntity && humanRole === GameRole.SEEKER && (
          <div>Seeker: ({seekerEntity.position.x}, {seekerEntity.position.y})</div>
        )}
      </div>
    </div>
  );
};
