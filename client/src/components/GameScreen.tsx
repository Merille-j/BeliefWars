import React, { useCallback, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { selectHumanRole } from '../store/gameStore';
import { HeatmapCanvas } from './HeatmapCanvas';
import { GameHUD } from './GameHUD';
import { ActionPanel } from './ActionPanel';
import { PhaseIndicator } from './PhaseIndicator';
import { RoundTracker } from './RoundTracker';
import { AlertOverlay } from './AlertOverlay';
import { BannerOverlay } from './BannerOverlay';
import { RoundHistory } from './RoundHistory';
import { EventContingencyPanel } from './EventContingencyPanel';
import {
  ClientAction,
  GamePhase,
  GameRole,
  PendingActionMode,
} from '../types/client.types';

interface GameScreenProps {
  onAction: (action: ClientAction) => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({ onAction }) => {
  const {
    humanPlayerId,
    gameState,
    pendingAction,
    selectedCells,
    setPendingAction,
    addSelectedCell,
    clearSelectedCells,
    activeEvent,
    alert,
  } = useGameStore();
  const humanRole = useGameStore(selectHumanRole);

  const phase = gameState?.phase ?? GamePhase.RECON;

  // Auto-activate move mode when Ghost enters OBJECTIVE phase
  useEffect(() => {
    if (humanRole === GameRole.GHOST && phase === GamePhase.OBJECTIVE) {
      setPendingAction('move');
    } else if (phase !== GamePhase.OBJECTIVE) {
      // Clear move mode when leaving OBJECTIVE phase; leave other modes alone
      const current = useGameStore.getState().pendingAction;
      if (current === 'move') setPendingAction('none');
    }
    // Clear A* path when leaving OBJECTIVE phase
    if (phase !== GamePhase.OBJECTIVE) {
      useGameStore.getState().setSuggestedPath(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, humanRole]);

  const handleCellClick = useCallback(
    (x: number, y: number) => {
      if (pendingAction === 'none') return;

      switch (pendingAction as PendingActionMode) {
        case 'throw_decoy':
          onAction({ type: 'THROW_DECOY', playerId: humanPlayerId, x, y });
          setPendingAction('none');
          break;
        case 'make_noise':
          onAction({ type: 'MAKE_NOISE', playerId: humanPlayerId, x, y, radius: 2 });
          setPendingAction('none');
          break;
        case 'lay_false_trail':
          addSelectedCell(x, y);
          if (selectedCells.length >= 2) {
            const trail = [...selectedCells, { x, y }];
            onAction({ type: 'LAY_FALSE_TRAIL', playerId: humanPlayerId, cells: trail });
            clearSelectedCells();
          }
          break;
        case 'move': {
          // Enforce adjacency on the client side too — only send valid moves
          const { entities } = useGameStore.getState();
          const ghost = entities.find(e => e.role === GameRole.GHOST);
          if (!ghost) break;
          const dx = Math.abs(x - ghost.position.x);
          const dy = Math.abs(y - ghost.position.y);
          if (dx + dy !== 1) break; // silently ignore non-adjacent clicks
          onAction({ type: 'MOVE', playerId: humanPlayerId, x, y });
          // Keep move mode active so player can keep moving with remaining AP
          break;
        }
        case 'scan':
          onAction({ type: 'SCAN', playerId: humanPlayerId, x, y, radius: 2 });
          setPendingAction('none');
          break;
        case 'lock':
          onAction({ type: 'LOCK', playerId: humanPlayerId, x, y });
          setPendingAction('none');
          break;
        default:
          break;
      }
    },
    [pendingAction, humanPlayerId, selectedCells, onAction, setPendingAction, addSelectedCell, clearSelectedCells]
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white font-mono flex flex-col overflow-x-hidden">
      <AlertOverlay />
      <BannerOverlay />

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-gray-900 border-b border-gray-800">
        {/* Row 1: title + role */}
        <div className="flex items-center justify-between px-3 sm:px-4 pt-2 pb-1 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-sm sm:text-lg font-black tracking-widest whitespace-nowrap"
              style={{
                background: 'linear-gradient(90deg, #00ff88, #00aaff)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              BELIEF WARS
            </span>
            <span className="text-gray-600 text-xs hidden sm:inline">|</span>
            <span className="text-gray-400 text-xs truncate hidden sm:inline">
              {humanRole === GameRole.GHOST ? '👻 Ghost' : '🔍 Seeker'}
            </span>
          </div>
          <RoundTracker />
        </div>

        {/* Row 2: phase indicator */}
        <div className="px-3 sm:px-4 pb-2">
          <PhaseIndicator />
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      {/*
        Layout:
        - lg+: side-by-side, canvas left (flex-1), panel right (fixed w-72)
        - <lg:  stacked, canvas on top, panel below (both scroll naturally)
      */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden">

        {/* Canvas column */}
        <div className="flex-1 flex flex-col items-center justify-start lg:justify-center
                        p-3 sm:p-4 bg-gray-950 lg:overflow-y-auto">
          {/* Square canvas wrapper — fills width, capped at 600px */}
          <div className="heatmap-canvas-wrapper">
            <HeatmapCanvas onCellClick={handleCellClick} />
          </div>

          {/* Legend */}
          <div className="mt-2 w-full max-w-[600px] flex flex-wrap items-center justify-between
                          gap-y-1 text-xs text-gray-500 px-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="flex gap-1 items-center">
                <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                <span>Ghost</span>
              </div>
              <div className="flex gap-1 items-center">
                <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
                <span>Seeker</span>
              </div>
              <div className="flex gap-1 items-center">
                <div className="w-3 h-3 border border-yellow-500 flex-shrink-0" />
                <span>Objective</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div
                className="w-16 sm:w-20 h-2 rounded flex-shrink-0"
                style={{ background: 'linear-gradient(90deg, #0a1628, #00aaff, #ffdd00, #ff6600, #ff0000)' }}
              />
              <span>0%→100%</span>
            </div>
          </div>
        </div>

        {/* Side panel — scrollable independently on desktop */}
        <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 flex flex-col gap-3 p-3
                        bg-gray-900 border-t lg:border-t-0 lg:border-l border-gray-800
                        lg:overflow-y-auto">
          <GameHUD />
          <EventContingencyPanel
            eventType={alert?.payload?.plan?.eventType ?? activeEvent?.type ?? 'fog'}
            plan={alert?.payload?.plan}
            affectedRegion={activeEvent?.affectedRegion ?? { x: 0, y: 0, radius: 0 }}
          />
          <ActionPanel onAction={onAction} />
          <RoundHistory variant="compact" />
          <ActiveEventDisplay />
        </div>

      </div>
    </div>
  );
};

const ActiveEventDisplay: React.FC = () => {
  const { activeEvent, alert } = useGameStore();
  if (!activeEvent) return null;

  const eventLabels: Record<string, { icon: string; label: string; color: string }> = {
    fog:               { icon: '🌫️', label: 'FOG',               color: 'text-gray-400 border-gray-600 bg-gray-900' },
    storm:             { icon: '⛈️', label: 'STORM',             color: 'text-yellow-400 border-yellow-700 bg-yellow-950' },
    sensor_disruption: { icon: '📡', label: 'SENSOR DISRUPTION', color: 'text-purple-400 border-purple-700 bg-purple-950' },
  };
  const info = eventLabels[activeEvent.type] ?? { icon: '⚡', label: activeEvent.type.toUpperCase(), color: 'text-white border-gray-600 bg-gray-900' };
  const plan = alert?.payload?.plan;

  return (
    <div className={`border rounded p-3 text-xs font-mono ${info.color} space-y-2`}>
      {/* Header */}
      <div className="font-bold text-sm">{info.icon} {info.label} ACTIVE</div>
      <div className="text-gray-400 text-xs">
        Region: ({activeEvent.affectedRegion.x}, {activeEvent.affectedRegion.y}) r={activeEvent.affectedRegion.radius}
      </div>

      {/* Contingency Plan Branches */}
      {plan && plan.branches && plan.branches.length >= 2 && (
        <div className="space-y-2 mt-3 pt-2 border-t border-current border-opacity-20">
          {/* Branch 1: Seeker Contingency */}
          <div className="bg-blue-950 border border-blue-700 rounded p-2">
            <div className="text-blue-400 font-bold text-xs mb-1">🔍 SEEKER CONTINGENCY</div>
            <div className="text-blue-300 text-xs mb-2">{plan.branches[0].condition}</div>
            <div className="space-y-1">
              {plan.branches[0].children && plan.branches[0].children.slice(0, 3).map((child, i) => (
                <div key={i} className="text-blue-200 text-xs bg-blue-900 px-1.5 py-0.5 rounded truncate">
                  {child.action?.type === 'SCAN' && `📡 SCAN (${child.action.x},${child.action.y}) r=${child.action.radius}`}
                  {child.action?.type === 'LOCK' && `🔒 LOCK (${child.action.x},${child.action.y})`}
                  {!child.action && child.condition}
                </div>
              ))}
              {plan.branches[0].children && plan.branches[0].children.length > 3 && (
                <div className="text-blue-300 text-xs opacity-70">+{plan.branches[0].children.length - 3} more options</div>
              )}
            </div>
          </div>

          {/* Branch 2: Ghost Contingency */}
          <div className="bg-green-950 border border-green-700 rounded p-2">
            <div className="text-green-400 font-bold text-xs mb-1">👻 GHOST CONTINGENCY</div>
            <div className="text-green-300 text-xs mb-2">{plan.branches[1].condition}</div>
            <div className="space-y-1">
              {plan.branches[1].children && plan.branches[1].children.slice(0, 3).map((child, i) => (
                <div key={i} className="text-green-200 text-xs bg-green-900 px-1.5 py-0.5 rounded truncate">
                  {child.action?.type === 'MOVE' && `↔️ MOVE (${child.action.x},${child.action.y})`}
                  {child.action?.type === 'LAY_FALSE_TRAIL' && `👣 TRAIL`}
                  {child.action?.type === 'MAKE_NOISE' && `📢 NOISE (${child.action.x},${child.action.y})`}
                  {child.action?.type === 'THROW_DECOY' && `🎯 DECOY (${child.action.x},${child.action.y})`}
                  {!child.action && child.condition}
                </div>
              ))}
              {plan.branches[1].children && plan.branches[1].children.length > 3 && (
                <div className="text-green-300 text-xs opacity-70">+{plan.branches[1].children.length - 3} more options</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
