import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import gameRoutes from './api/gameRoutes';
import { registerSocketHandlers } from './api/socketHandlers';
import { gameEngine } from './GameEngine';

const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Express App 

const app = express();

app.use(cors({
  origin: CLIENT_ORIGIN,
  methods: ['GET', 'POST'],
  credentials: true,
}));

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', game: 'Belief Wars', version: '1.0.0' });
});

// Game API routes
app.use('/api/game', gameRoutes);

// HTTP + Socket.IO Server

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  registerSocketHandlers(io, socket);
});

// Start 

httpServer.listen(PORT, () => {
  console.log(`[Belief Wars Server] Running on http://localhost:${PORT}`);
  console.log(`[Belief Wars Server] Accepting connections from ${CLIENT_ORIGIN}`);
});

// Game Tick Loop 
// Runs every 500ms to drive AI turns, belief diffusion, and win-condition checks.
const TICK_INTERVAL_MS = 500;
export let matchEndBroadcast = false; // guard: only send game:end once per match
export function resetMatchEndBroadcast() { matchEndBroadcast = false; }

setInterval(() => {
  try {
    if (!gameEngine.initialized) return;

    // Don't keep ticking after the match is over
    if (gameEngine.isMatchOver()) {
      if (!matchEndBroadcast) {
        matchEndBroadcast = true;
        const finalState = gameEngine.getFullState();
        io.emit('game:end', {
          winner: gameEngine.getMatchWinner(),
          state: finalState,
        });
      }
      return;
    }

    gameEngine.tick();
    io.emit('game:update', gameEngine.getFullState());
  } catch (err) {
    console.error('[Tick] Error during game tick:', err);
  }
}, TICK_INTERVAL_MS);

export { app, io };
