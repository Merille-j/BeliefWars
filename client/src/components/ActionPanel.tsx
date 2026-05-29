import React from 'react';
import { useGameStore } from '../store/gameStore';
import { selectHumanRole, selectSeekerAP, selectGhostAP } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import { GameRole, GamePhase, ClientAction, GameState, Entity } from '../types/client.types';

interface ActionPanelProps {
  onAction: (action: ClientAction) => void;
}

/**
 * Context-sensitive action buttons.
 * Shows Ghost actions in MANIPULATION/OBJECTIVE phases.
 * Shows Seeker actions in COLLAPSE phase.
 * Displays MCTS recommendations for Seeker.
 */
export const ActionPanel: React.FC<ActionPanelProps> = ({ onAction }) => {
  const {
    gameState,
    humanPlayerId,
    recommendations,
    pendingAction,
    selectedCells,
    setPendingAction,
    clearSelectedCells,
    suggestedPath,
    entities,
  } = useGameStore();
  const humanRole = useGameStore(selectHumanRole);
  const seekerAP = useGameStore(selectSeekerAP);
  const ghostAP = useGameStore(selectGhostAP);
  const { requestPath, clearPath } = useSocket();

  const phase = gameState?.phase ?? GamePhase.RECON;

  const handleEndPhase = () => {
    onAction({ type: 'END_PHASE', playerId: humanPlayerId });
    setPendingAction('none');
  };

  const isGhost = humanRole === GameRole.GHOST;
  const isSeeker = humanRole === GameRole.SEEKER;

  return (
    <div className="flex flex-col gap-3 p-4 bg-gray-900 rounded-lg border border-gray-700 font-mono text-sm">
      <h3 className="text-gray-300 text-xs uppercase tracking-wider font-bold">Actions</h3>

      {/* ─── Ghost: Manipulation Phase ─────────────────────────────────────── */}
      {isGhost && phase === GamePhase.MANIPULATION && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider">Manipulation</p>
            <span className="text-green-400 text-xs font-bold">{ghostAP} / 8 AP</span>
          </div>

          {/* Instruction when an action is selected */}
          {(pendingAction === 'throw_decoy' || pendingAction === 'make_noise' || pendingAction === 'lay_false_trail') && (
            <div className="bg-yellow-950 border border-yellow-600 rounded px-2 py-1.5 text-xs text-yellow-300 flex items-center gap-2">
              <span className="text-yellow-400 text-base">👆</span>
              <span>
                {pendingAction === 'throw_decoy'     && 'Click any cell on the grid to throw the decoy there'}
                {pendingAction === 'make_noise'      && 'Click any cell to create noise in a 5×5 area around it'}
                {pendingAction === 'lay_false_trail' && `Click ${Math.max(0, 3 - selectedCells.length)} more cell${3 - selectedCells.length !== 1 ? 's' : ''} to lay the trail`}
              </span>
            </div>
          )}

          <ManipulationButton
            label="🎯 Throw Decoy"
            description="+30% spike at one cell"
            cost="2 AP"
            active={pendingAction === 'throw_decoy'}
            disabled={ghostAP < 2}
            onClick={() => setPendingAction(pendingAction === 'throw_decoy' ? 'none' : 'throw_decoy')}
          />

          <ManipulationButton
            label="📢 Make Noise"
            description="+15% across 5×5 area"
            cost="2 AP"
            active={pendingAction === 'make_noise'}
            disabled={ghostAP < 2}
            onClick={() => setPendingAction(pendingAction === 'make_noise' ? 'none' : 'make_noise')}
          />

          <ManipulationButton
            label="👣 Lay False Trail"
            description="+20% per cell, click 3 cells"
            cost="3 AP"
            active={pendingAction === 'lay_false_trail'}
            disabled={ghostAP < 3}
            onClick={() => {
              if (pendingAction === 'lay_false_trail') {
                clearSelectedCells();
              } else {
                setPendingAction('lay_false_trail');
              }
            }}
          />

          {/* False trail progress inline */}
          {pendingAction === 'lay_false_trail' && selectedCells.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-1 bg-orange-950 border border-orange-700 rounded text-xs text-orange-300">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className={`w-5 h-5 rounded border flex items-center justify-center text-xs font-bold ${
                      i < selectedCells.length
                        ? 'bg-orange-500 border-orange-400 text-black'
                        : 'bg-gray-800 border-gray-600 text-gray-600'
                    }`}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              <span>{selectedCells.length}/3 cells selected</span>
            </div>
          )}
        </div>
      )}

      {/* ─── Ghost: Objective Phase ────────────────────────────────────────── */}
      {isGhost && phase === GamePhase.OBJECTIVE && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-green-400 text-xs font-bold uppercase tracking-wider">Movement</p>
            <span className="text-green-400 text-xs font-bold">{ghostAP} / 8 AP</span>
          </div>

          {/* AP bar */}
          <div className="w-full bg-gray-700 rounded-full h-2 mb-1">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(ghostAP / 8) * 100}%` }}
            />
          </div>

          <div className={`
            relative w-full text-left rounded-lg border-2 p-3
            ${ghostAP < 1
              ? 'opacity-40 border-gray-700 bg-gray-900'
              : pendingAction === 'move'
                ? 'border-green-400 bg-green-900/50 ring-2 ring-green-400/40'
                : 'border-green-700 bg-green-950/30'
            }
          `}>
            {pendingAction === 'move' && (
              <span className="absolute top-1.5 right-2 text-xs font-bold text-green-300 bg-green-800 px-1.5 py-0.5 rounded">
                ACTIVE
              </span>
            )}
            <div className="text-green-400 font-bold text-xs mb-0.5">🚶 Move (Adjacent only)</div>
            <div className="text-gray-400 text-xs leading-relaxed">
              Click any highlighted neighbour cell — 1 AP per step, up to {ghostAP} more step{ghostAP !== 1 ? 's' : ''}
            </div>
            <div className="text-green-600 text-xs mt-1">↑ ↓ ← → only — no diagonals · Complete ALL objectives to win</div>
          </div>

          {/* A* Path Suggestions — one button per incomplete objective */}
          <PathSuggestions
            gameState={gameState}
            entities={entities}
            suggestedPath={suggestedPath}
            onRequestPath={requestPath}
            onClearPath={clearPath}
          />

          <CompleteObjectiveButtons onAction={onAction} />
        </div>
      )}

      {/* ─── Seeker: Collapse Phase ────────────────────────────────────────── */}
      {isSeeker && phase === GamePhase.COLLAPSE && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-red-400 text-xs font-bold uppercase tracking-wider">Detection</p>
            <span className="text-blue-400 text-xs font-bold">{seekerAP} / 10 AP</span>
          </div>

          <ActionButton
            label="📡 Scan Zone"
            description={`+10% per cell in radius 2 — 2 AP (have ${seekerAP})`}
            active={pendingAction === 'scan'}
            disabled={seekerAP < 2}
            onClick={() => setPendingAction(pendingAction === 'scan' ? 'none' : 'scan')}
            color="blue"
          />

          <ActionButton
            label="🔒 Lock Cell"
            description={`Attempt to confirm Ghost — 4 AP (have ${seekerAP})`}
            active={pendingAction === 'lock'}
            disabled={seekerAP < 4}
            onClick={() => setPendingAction(pendingAction === 'lock' ? 'none' : 'lock')}
            color="red"
          />

          {/* MCTS Recommendations */}
          {recommendations.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-xs uppercase tracking-wider">AI Recommendations</p>
                <span className="text-gray-600 text-xs">MCTS</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {recommendations.slice(0, 5).map((rec, i) => {
                  const isLock = rec.action.type === 'LOCK';
                  const ax = (rec.action as { x: number; y: number }).x;
                  const ay = (rec.action as { x: number; y: number }).y;
                  const conf = rec.confidence;
                  // Colour: green = high confidence, yellow = medium, red = low
                  const confColor = conf > 0.7 ? 'text-green-400 border-green-700 bg-green-950/40'
                                  : conf > 0.4 ? 'text-yellow-400 border-yellow-700 bg-yellow-950/40'
                                  : 'text-gray-400 border-gray-700 bg-gray-800/40';
                  const rankLabel = ['★★★', '★★☆', '★☆☆', '☆☆☆', '☆☆☆'][i] ?? '☆☆☆';

                  return (
                    <button
                      key={i}
                      className={`w-full text-left border rounded-lg px-2.5 py-2 text-xs transition-all hover:brightness-125 ${confColor}`}
                      onClick={() => onAction({ ...rec.action, playerId: humanPlayerId } as ClientAction)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold">
                          {isLock ? '🔒 LOCK' : '📡 SCAN'} ({ax},{ay})
                        </span>
                        <span className="text-xs opacity-70">{rankLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Confidence bar */}
                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              conf > 0.7 ? 'bg-green-500' : conf > 0.4 ? 'bg-yellow-500' : 'bg-gray-500'
                            }`}
                            style={{ width: `${conf * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold tabular-nums w-8 text-right">
                          {(conf * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="text-gray-500 text-xs mt-0.5">
                        {isLock
                          ? `Lock cell (${ax},${ay}) — costs 4 AP`
                          : `Scan zone around (${ax},${ay}) — costs 2 AP`}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-gray-600 text-xs mt-1.5 text-center">
                Click a recommendation to execute it
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── Recon Phase ──────────────────────────────────────────────────── */}
      {phase === GamePhase.RECON && (
        <div className="text-gray-400 text-xs p-2 bg-gray-800 rounded">
          <p className="text-indigo-400 font-bold mb-1">Recon Phase</p>
          <p>Observe the heatmap and plan your strategy.</p>
          <p className="mt-1">Click "End Phase" when ready.</p>
        </div>
      )}

      {/* ─── AND/OR Events Phase ──────────────────────────────────────────── */}
      {phase === GamePhase.AND_OR_EVENTS && (
        <div className="text-gray-400 text-xs p-2 bg-gray-800 rounded">
          <p className="text-purple-400 font-bold mb-1">Events Phase</p>
          <p>Nondeterministic events may occur.</p>
          <p className="mt-1">Contingency plans are being evaluated.</p>
        </div>
      )}

      {/* ─── End Phase Button ─────────────────────────────────────────────── */}
      <button
        className="mt-2 w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded text-gray-300 text-xs font-bold uppercase tracking-wider transition-colors"
        onClick={handleEndPhase}
      >
        ⏭ End Phase
      </button>

      {/* Cancel pending action */}
      {pendingAction !== 'none' && (
        <button
          className="w-full py-1 px-4 bg-red-900 hover:bg-red-800 border border-red-700 rounded text-red-300 text-xs transition-colors"
          onClick={() => setPendingAction('none')}
        >
          ✕ Cancel
        </button>
      )}
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ManipulationButtonProps {
  label: string;
  description: string;
  cost: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const ManipulationButton: React.FC<ManipulationButtonProps> = ({
  label, description, cost, active = false, disabled = false, onClick,
}) => {
  return (
    <button
      className={`
        relative w-full text-left rounded-lg border-2 p-3 transition-all duration-150
        ${disabled
          ? 'opacity-40 cursor-not-allowed border-gray-700 bg-gray-900'
          : active
            ? 'border-yellow-400 bg-yellow-900/50 ring-2 ring-yellow-400/40 cursor-pointer'
            : 'border-yellow-700 bg-yellow-950/30 hover:border-yellow-500 hover:bg-yellow-900/40 cursor-pointer'
        }
      `}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {/* Active badge */}
      {active && (
        <span className="absolute top-1.5 right-2 text-xs font-bold text-yellow-300 bg-yellow-800 px-1.5 py-0.5 rounded">
          SELECTED
        </span>
      )}

      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className={`font-bold text-xs ${active ? 'text-yellow-300' : 'text-yellow-400'}`}>
            {label}
          </div>
          <div className="text-gray-400 text-xs mt-0.5 leading-relaxed">{description}</div>
        </div>
        <div className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded border mt-0.5 ${
          disabled
            ? 'text-gray-600 border-gray-700'
            : active
              ? 'text-yellow-200 border-yellow-500 bg-yellow-900'
              : 'text-yellow-500 border-yellow-700'
        }`}>
          {cost}
        </div>
      </div>
    </button>
  );
};

interface ActionButtonProps {
  label: string;
  description: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  color: 'yellow' | 'green' | 'blue' | 'red';
}

const COLOR_CLASSES: Record<string, string> = {
  yellow: 'border-yellow-600 text-yellow-400 bg-yellow-900/30 hover:bg-yellow-900/50',
  green: 'border-green-600 text-green-400 bg-green-900/30 hover:bg-green-900/50',
  blue: 'border-blue-600 text-blue-400 bg-blue-900/30 hover:bg-blue-900/50',
  red: 'border-red-600 text-red-400 bg-red-900/30 hover:bg-red-900/50',
};

const ACTIVE_CLASSES: Record<string, string> = {
  yellow: 'border-yellow-400 bg-yellow-900/60 ring-1 ring-yellow-400',
  green: 'border-green-400 bg-green-900/60 ring-1 ring-green-400',
  blue: 'border-blue-400 bg-blue-900/60 ring-1 ring-blue-400',
  red: 'border-red-400 bg-red-900/60 ring-1 ring-red-400',
};

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  description,
  active = false,
  disabled = false,
  onClick,
  color,
}) => {
  const baseClass = 'border rounded p-2 text-left transition-all cursor-pointer';
  const colorClass = active ? ACTIVE_CLASSES[color] : COLOR_CLASSES[color];
  const disabledClass = disabled ? 'opacity-40 cursor-not-allowed' : '';

  return (
    <button
      className={`${baseClass} ${colorClass} ${disabledClass}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <div className="font-bold text-xs">{label}</div>
      <div className="text-gray-400 text-xs mt-0.5">{description}</div>
    </button>
  );
};

interface CompleteObjectiveButtonsProps {
  onAction: (action: ClientAction) => void;
}

const CompleteObjectiveButtons: React.FC<CompleteObjectiveButtonsProps> = ({ onAction }) => {
  const { gameState, humanPlayerId, entities } = useGameStore();
  const objectives = gameState?.objectives ?? [];
  const ghostEntity = entities.find(e => e.role === GameRole.GHOST);

  const reachableObjectives = objectives.filter(obj => {
    if (obj.completed) return false;
    if (!ghostEntity) return false;
    return (
      ghostEntity.position.x === obj.position.x &&
      ghostEntity.position.y === obj.position.y
    );
  });

  if (reachableObjectives.length === 0) return null;

  return (
    <>
      {reachableObjectives.map(obj => (
        <button
          key={obj.id}
          className="border border-green-500 bg-green-900/40 hover:bg-green-900/60 rounded p-2 text-left transition-all"
          onClick={() =>
            onAction({
              type: 'COMPLETE_OBJECTIVE',
              playerId: humanPlayerId,
              objectiveId: obj.id,
            })
          }
        >
          <div className="text-green-400 font-bold text-xs">✓ Complete {obj.label}</div>
          <div className="text-gray-400 text-xs">You are at this objective!</div>
        </button>
      ))}
    </>
  );
};

// ─── A* Path Suggestions ─────────────────────────────────────────────────────

interface PathSuggestionsProps {
  gameState: GameState | null;
  entities: Entity[];
  suggestedPath: Array<{ x: number; y: number }> | null;
  onRequestPath: (goalX: number, goalY: number) => void;
  onClearPath: () => void;
}

/**
 * Shows A* path buttons for each incomplete objective.
 * Clicking a button requests the safest path (lowest probability cost) to that objective.
 * The path is drawn on the heatmap canvas as a numbered step overlay.
 */
const PathSuggestions: React.FC<PathSuggestionsProps> = ({
  gameState,
  entities,
  suggestedPath,
  onRequestPath,
  onClearPath,
}) => {
  const objectives = gameState?.objectives ?? [];
  const ghostEntity = entities.find(e => e.role === GameRole.GHOST);
  const incomplete = objectives.filter(o => !o.completed);

  if (incomplete.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-green-600 text-xs font-bold uppercase tracking-wider">
          🗺 A* Safe Routes
        </span>
        {suggestedPath && (
          <button
            className="text-xs text-gray-500 hover:text-gray-300 underline"
            onClick={onClearPath}
          >
            Clear path
          </button>
        )}
      </div>
      <p className="text-gray-600 text-xs">
        Click an objective to see the safest path (avoids hot zones).
      </p>
      <div className="flex flex-col gap-1">
        {incomplete.map(obj => {
          const dist = ghostEntity
            ? Math.abs(obj.position.x - ghostEntity.position.x) +
              Math.abs(obj.position.y - ghostEntity.position.y)
            : '?';
          return (
            <button
              key={obj.id}
              className="flex items-center justify-between border border-green-800 bg-green-950/30 hover:bg-green-900/40 rounded px-2 py-1.5 text-xs transition-all"
              onClick={() => onRequestPath(obj.position.x, obj.position.y)}
            >
              <span className="text-green-400 font-bold">{obj.label}</span>
              <span className="text-gray-500">({obj.position.x},{obj.position.y})</span>
              <span className="text-gray-600">{dist} steps</span>
              <span className="text-green-600">Show path →</span>
            </button>
          );
        })}
      </div>
      {suggestedPath && suggestedPath.length > 0 && (
        <div className="bg-green-950/40 border border-green-800 rounded px-2 py-1.5 text-xs text-green-400">
          <span className="font-bold">Path found:</span>{' '}
          {suggestedPath.length} step{suggestedPath.length !== 1 ? 's' : ''} — numbered on the grid
        </div>
      )}
      {suggestedPath && suggestedPath.length === 0 && (
        <div className="bg-red-950/40 border border-red-800 rounded px-2 py-1.5 text-xs text-red-400">
          No path found to that objective.
        </div>
      )}
    </div>
  );
};
