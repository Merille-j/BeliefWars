import { Server, Socket } from 'socket.io';
import { gameEngine } from '../GameEngine';
import { Action } from '../types/game.types';
import { EventType } from '../types/game.types';
import { eventBus } from '../core/EventBus';
import { resetMatchEndBroadcast } from '../index';

/**
 * Register Socket.IO event handlers for a connected client.
 */
export function registerSocketHandlers(io: Server, socket: Socket): void {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // ─── game:start ────────────────────────────────────────────────────────────
  socket.on('game:start', (data: { playerId?: string }) => {
    try {
      const humanPlayerId = data?.playerId || socket.id;
      resetMatchEndBroadcast();
      gameEngine.initialize({ humanPlayerId });

      const state = gameEngine.getFullState();
      socket.emit('game:update', state);
      console.log(`[Socket] Game started for player: ${humanPlayerId}`);
    } catch (err) {
      console.error('[Socket] game:start error:', err);
      socket.emit('game:error', { message: 'Failed to start game' });
    }
  });

  // ─── game:action ───────────────────────────────────────────────────────────
  socket.on('game:action', (data: { action: Action }) => {
    try {
      const action = data?.action;
      if (!action || !action.type) {
        socket.emit('game:error', { message: 'Invalid action' });
        return;
      }

      const result = gameEngine.handlePlayerAction(action);
      const state = gameEngine.getFullState();

      // Send updated state to the acting player only (single-player game)
      socket.emit('game:update', state);

      // Send action result to the acting player
      socket.emit('game:action:result', {
        success: result.success,
        message: result.message,
      });

      // Check for match end
      if (gameEngine.isMatchOver()) {
        io.emit('game:end', {
          winner: gameEngine.getMatchWinner(),
          state,
        });
      }
    } catch (err) {
      console.error('[Socket] game:action error:', err);
      socket.emit('game:error', { message: 'Failed to process action' });
    }
  });

  // ─── game:state ────────────────────────────────────────────────────────────
  socket.on('game:state', () => {
    try {
      const state = gameEngine.getFullState();
      socket.emit('game:update', state);
    } catch (err) {
      console.error('[Socket] game:state error:', err);
      socket.emit('game:error', { message: 'Failed to get state' });
    }
  });

  // ─── Belief collapse alert ─────────────────────────────────────────────────
  const unsubCollapse = eventBus.subscribe(EventType.BELIEF_COLLAPSE, (payload) => {
    io.emit('game:alert', {
      type: 'BELIEF_COLLAPSE',
      message: 'GHOST DETECTED! Belief collapsed!',
      payload,
    });
  });

  // ─── Nondeterministic event alert ──────────────────────────────────────────
  const unsubEvent = eventBus.subscribe(EventType.NONDETERMINISTIC_EVENT_OCCURRED, (payload) => {
    io.emit('game:alert', {
      type: 'NONDETERMINISTIC_EVENT',
      message: 'A nondeterministic event has occurred!',
      payload,
    });
  });

  // ─── Phase ended ───────────────────────────────────────────────────────────
  const unsubPhaseEnded = eventBus.subscribe(EventType.PHASE_ENDED, (payload) => {
    const p = payload as { phase: string };
    io.emit('game:phase_end', {
      phase: p.phase,
      humanRole: gameEngine.getHumanRole(),
    });
  });

  // ─── Round won (also covers cycle boundary) ────────────────────────────────
  const unsubRoundWon = eventBus.subscribe(EventType.ROUND_WON, (payload) => {
    const p = payload as {
      winner: string;
      round: number;
      humanWins: number;
      aiWins: number;
      entry: { winCondition: string; humanWon: boolean; humanRole: string; objectivesCompleted: number };
    };
    io.emit('game:round_end', {
      round: p.round,
      winner: p.winner,
      humanWon: p.entry.humanWon,
      humanRole: p.entry.humanRole,
      winCondition: p.entry.winCondition,
      objectivesCompleted: p.entry.objectivesCompleted,
      humanWins: p.humanWins,
      aiWins: p.aiWins,
    });
  });

  // ─── Disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
    unsubCollapse();
    unsubEvent();
    unsubPhaseEnded();
    unsubRoundWon();
  });
}
