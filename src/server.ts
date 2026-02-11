import express, { Request, Response } from 'express';
import os from 'os';
import { MoveHandler } from './game/move-handler';
import { KingdomWarsHandler } from './game/kingdom-wars-handler';
import { requestLogger } from './middleware/request-logger';

const app = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (must be after body parsing)
app.use(requestLogger);

// Initialize handlers
const moveHandler = new MoveHandler(
  (process.env.AI_STRATEGY as 'minimax' | 'mcts' | 'greedy') || 'minimax'
);

const kingdomWarsHandler = new KingdomWarsHandler(
  {
    name: process.env.BOT_NAME || 'NIXathon2026 Bot',
    version: process.env.BOT_VERSION || '1.0'
  },
  true // MCTS enabled by default
);

// Kingdom Wars endpoints
app.post('/negotiate', async (req: Request, res: Response): Promise<void> => {
  await kingdomWarsHandler.handleNegotiate(req, res);
});

app.post('/combat', async (req: Request, res: Response): Promise<void> => {
  await kingdomWarsHandler.handleCombat(req, res);
});

app.get('/info', (req: Request, res: Response): void => {
  kingdomWarsHandler.getBotInfo(req, res);
});

// Legacy game move endpoint (for other game types)
app.post('/move', async (req: Request, res: Response): Promise<void> => {
  await moveHandler.handleMove(req, res);
});

app.get('/move', async (req: Request, res: Response): Promise<void> => {
  await moveHandler.handleMove(req, res);
});

// Health check endpoint
app.get('/healthz', (req: Request, res: Response): void => {
  try {
    // Verify system is up and running
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;
    
    // Check if system is healthy (memory usage below 90% and process is running)
    const isHealthy = memoryUsagePercent < 90 && process.uptime() > 0;
    
    if (isHealthy) {
      // System is up and running - return required format
      res.status(200).json({ status: 'OK' });
    } else {
      // System is degraded - return 503
      res.status(503).json({ status: 'ERROR' });
    }
  } catch (error) {
    // Error occurred during health check
    res.status(503).json({ status: 'ERROR' });
  }
});

// Start server
app.listen(PORT, (): void => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check endpoint: http://localhost:${PORT}/healthz`);
  console.log(`Kingdom Wars - Negotiate: http://localhost:${PORT}/negotiate`);
  console.log(`Kingdom Wars - Combat: http://localhost:${PORT}/combat`);
  console.log(`Kingdom Wars - Info: http://localhost:${PORT}/info`);
  console.log(`Legacy move endpoint: http://localhost:${PORT}/move`);
  console.log(`AI Strategy: ${process.env.AI_STRATEGY || 'minimax'}`);
  console.log(`MCTS Enabled: Yes (500 iterations, 800ms limit)`);
  console.log(`Game Theory Enabled: Yes`);
  console.log(`Multi-turn Lookahead: Yes (3 turns ahead)`);
  console.log(`Enemy Resource Tracker: Yes`);
  console.log(`All features enabled by default`);
});
