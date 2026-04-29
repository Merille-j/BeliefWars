import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';
import { ClientAction, SerializedGameState, GameRole } from '../types/client.types';

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

    const onAlert = (data: { type: string; message: string }) => {
      const alertType = data.type === 'BELIEF_COLLAPSE' ? 'collapse' : 'event';
      setAlert({
        active: true,
        message: data.message,
        type: alertType,
      });

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        useGameStore.getState().dismissAlert();
      }, 3000);
    };

    const onEnd = (data: { winner: GameRole; state: SerializedGameState }) => {
      if (data.state) setGameState(data.state);
      setMatchOver(data.winner);
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

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
      socket.off('game:update', onUpdate);
      socket.off('game:alert', onAlert);
      socket.off('game:end', onEnd);
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
      if (data.success && data.path) {
        useGameStore.getState().setSuggestedPath(data.path);
      } else {
        useGameStore.getState().setSuggestedPath(null);
      }
    } catch {
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
