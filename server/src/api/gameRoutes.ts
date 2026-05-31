import { Router, Request, Response } from 'express';
import { gameEngine } from '../GameEngine';
import { Action } from '../types/game.types';

const router = Router();

/**
 * POST /api/game/new
 * Start a new match. Accepts optional playerId in body.
 */
router.post('/new', (req: Request, res: Response) => {
  try {
    const humanPlayerId = (req.body?.playerId as string) || 'human';
    gameEngine.initialize({ humanPlayerId });
    const state = gameEngine.getFullState();
    res.json({ success: true, state });
  } catch (err) {
    console.error('[gameRoutes] /new error:', err);
    res.status(500).json({ success: false, error: 'Failed to start game' });
  }
});

/**
 * GET /api/game/state
 * Get the current full game state.
 */
router.get('/state', (_req: Request, res: Response) => {
  try {
    const state = gameEngine.getFullState();
    res.json({ success: true, state });
  } catch (err) {
    console.error('[gameRoutes] /state error:', err);
    res.status(500).json({ success: false, error: 'Failed to get state' });
  }
});

/**
 * POST /api/game/action
 * Submit a player action.
 * Body: { action: Action }
 */
router.post('/action', (req: Request, res: Response) => {
  try {
    const action = req.body?.action as Action;
    if (!action || !action.type) {
      res.status(400).json({ success: false, error: 'Invalid action' });
      return;
    }

    const result = gameEngine.handlePlayerAction(action);
    const state = gameEngine.getFullState();

    res.json({
      success: result.success,
      message: result.message,
      state,
      matchOver: gameEngine.isMatchOver(),
      matchWinner: gameEngine.getMatchWinner(),
    });
  } catch (err) {
    console.error('[gameRoutes] /action error:', err);
    res.status(500).json({ success: false, error: 'Failed to process action' });
  }
});

/**
 * GET /api/game/recommendations
 * Get MCTS recommendations for the Seeker.
 */
router.get('/recommendations', (_req: Request, res: Response) => {
  try {
    const state = gameEngine.getFullState();
    res.json({
      success: true,
      recommendations: state.recommendations,
    });
  } catch (err) {
    console.error('[gameRoutes] /recommendations error:', err);
    res.status(500).json({ success: false, error: 'Failed to get recommendations' });
  }
});

/**
 * POST /api/game/trigger-event
 * Development-only: force generation of a nondeterministic event and return the new state.
 */
router.post('/trigger-event', (_req: Request, res: Response) => {
  try {
    const event = (gameEngine as any).triggerEvent ? gameEngine.triggerEvent() : null;
    const state = gameEngine.getFullState();
    res.json({ success: true, event, state });
  } catch (err) {
    console.error('[gameRoutes] /trigger-event error:', err);
    res.status(500).json({ success: false, error: 'Failed to trigger event' });
  }
});

/**
 * GET /api/game/pathfinding
 * Get A* pathfinding from Ghost's current position to a target.
 * Body: { goalX: number, goalY: number }
 */
router.post('/pathfinding', (req: Request, res: Response) => {
  try {
    const { goalX, goalY } = req.body;
    if (goalX === undefined || goalY === undefined) {
      res.status(400).json({ success: false, error: 'Missing goalX or goalY' });
      return;
    }
    const path = gameEngine.getPathToGoal(goalX, goalY);
    res.json({ success: true, path });
  } catch (err) {
    console.error('[gameRoutes] /pathfinding error:', err);
    res.status(500).json({ success: false, error: 'Failed to compute path' });
  }
});

export default router;
