import express, { Request, Response } from 'express';
import os from 'os';
import { MoveHandler } from './game/move-handler';

const app = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize move handler (strategy can be changed via env var)
const moveHandler = new MoveHandler(
  (process.env.AI_STRATEGY as 'minimax' | 'mcts' | 'greedy') || 'minimax'
);

// Game move endpoint - receives game state and returns optimal move
app.post('/move', async (req: Request, res: Response): Promise<void> => {
  await moveHandler.handleMove(req, res);
});

// Alternative GET endpoint for move (if game state comes via query params)
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
  console.log(`Game move endpoint: http://localhost:${PORT}/move`);
  console.log(`AI Strategy: ${process.env.AI_STRATEGY || 'minimax'}`);
});
