import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';
import { ClientAction, SerializedGameState, GameRole, GamePhase } from '../types/client.types';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

let socketInstance: Socket | null = null;

function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return socketInstance;
}

/**
 * Custom hook for Socket.IO connection.
 * Connects to the server, listens for game events, and updates the Zustand store.
 */
export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { setGameState, setAlert, setMatchOver } = useGameStore();

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    // ─── Event Listeners ───────────────────────────────────────────────────

    const onUpdate = (state: SerializedGameState) => {
      setGameState(state);
    };

    const onAlert = (data: { type: string; message: string; payload?: any }) => {
      const alertType = data.type === 'BELIEF_COLLAPSE' ? 'collapse' : 'event';
      setAlert({
        active: true,
        message: data.message,
        type: alertType,
        payload: data.payload,
      });
      // Auto-dismiss is handled exclusively by AlertOverlay's useEffect
    };

    const onEnd = (data: { winner: GameRole; state: SerializedGameState }) => {
      if (data.state) setGameState(data.state);
      setMatchOver(data.winner);
    };

    const onPhaseEnd = (data: { phase: GamePhase; humanRole: GameRole }) => {
      const { setBanner, cyclesCompleted, cyclesPerRound } = useGameStore.getState();
      // Cycle boundary: COLLAPSE just ended and it was NOT the last cycle
      const isCycleBoundary = data.phase === GamePhase.COLLAPSE && cyclesCompleted < cyclesPerRound - 1;
      if (isCycleBoundary) {
        setBanner({
          type: 'cycle_end',
          phase: data.phase,
          humanRole: data.humanRole,
          cycleNumber: cyclesCompleted + 1,
        });
      } else {
        setBanner({
          type: 'phase_end',
          phase: data.phase,
          humanRole: data.humanRole,
        });
      }
    };

    const onRoundEnd = (data: {
      round: number;
      winner: GameRole;
      humanWon: boolean;
      humanRole: GameRole;
      winCondition: 'objectives_completed' | 'ghost_locked' | 'ghost_survived';
      objectivesCompleted: number;
      humanWins: number;
      aiWins: number;
    }) => {
      useGameStore.getState().setBanner({
        type: 'round_end',
        round: data.round,
        winner: data.winner,
        humanWon: data.humanWon,
        humanRole: data.humanRole,
        winCondition: data.winCondition,
        objectivesCompleted: data.objectivesCompleted,
        humanWins: data.humanWins,
        aiWins: data.aiWins,
      });
    };

    const onConnect = () => {
      console.log('[Socket] Connected:', socket.id);
    };

    const onDisconnect = () => {
      console.log('[Socket] Disconnected');
    };

    const onError = (err: Error) => {
      console.error('[Socket] Error:', err);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);
    socket.on('game:update', onUpdate);
    socket.on('game:alert', onAlert);
    socket.on('game:end', onEnd);
    socket.on('game:phase_end', onPhaseEnd);
    socket.on('game:round_end', onRoundEnd);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
      socket.off('game:update', onUpdate);
      socket.off('game:alert', onAlert);
      socket.off('game:end', onEnd);
      socket.off('game:phase_end', onPhaseEnd);
      socket.off('game:round_end', onRoundEnd);
    };
  }, [setGameState, setAlert, setMatchOver]);

  /**
   * Start a new game via Socket.IO.
   * Reads humanPlayerId from store at call time to avoid stale closure.
   */
  const startGame = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const { humanPlayerId } = useGameStore.getState();
    socket.emit('game:start', { playerId: humanPlayerId });
  }, []);

  /**
   * Send a player action to the server.
   */
  const sendAction = useCallback((action: ClientAction) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('game:action', { action });
  }, []);

  /**
   * Request current game state.
   */
  const requestState = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('game:state');
  }, []);

  /**
   * Request A* path from Ghost's current position to a goal cell.
   * Fetches via REST (not socket) since it's a one-off query.
   * Stores the result in the Zustand store as suggestedPath.
   */
  const requestPath = useCallback(async (goalX: number, goalY: number) => {
    try {
      const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/game/pathfinding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalX, goalY }),
      });
      const data = await res.json();
      console.log('[requestPath] response:', data);
      if (data.success && Array.isArray(data.path) && data.path.length > 0) {
        useGameStore.getState().setSuggestedPath(data.path);
      } else {
        // path is null (no path found) or empty (already at goal)
        useGameStore.getState().setSuggestedPath(data.path ?? []);
      }
    } catch (err) {
      console.error('[requestPath] fetch error:', err);
      useGameStore.getState().setSuggestedPath(null);
    }
  }, []);

  /**
   * Clear the A* suggested path overlay.
   */
  const clearPath = useCallback(() => {
    useGameStore.getState().setSuggestedPath(null);
  }, []);

  return { startGame, sendAction, requestState, requestPath, clearPath };
}
