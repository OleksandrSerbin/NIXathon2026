import { Request, Response } from 'express';
import { GameRequest, GameResponse } from '../types/game';
import { AIStrategy, MinimaxStrategy, MCTSStrategy, GreedyStrategy } from './ai-strategies';

/**
 * Game move handler - processes incoming game state and returns optimal move
 */
export class MoveHandler {
  private strategy: AIStrategy;

  constructor(strategyType: 'minimax' | 'mcts' | 'greedy' = 'minimax') {
    switch (strategyType) {
      case 'minimax':
        // Optimized Minimax with Alpha-Beta Pruning
        // Depth 8 is good for Connect Four-like games
        // Time limit from env or default to 5 seconds
        const timeLimit = parseInt(process.env.MOVE_TIME_LIMIT_MS || '5000', 10);
        const maxDepth = parseInt(process.env.MINIMAX_DEPTH || '8', 10);
        this.strategy = new MinimaxStrategy(maxDepth, true, timeLimit, true);
        break;
      case 'mcts':
        this.strategy = new MCTSStrategy(1000, 1.41);
        break;
      case 'greedy':
        this.strategy = new GreedyStrategy();
        break;
      default:
        this.strategy = new GreedyStrategy();
    }
  }

  /**
   * Handle game move request
   */
  async handleMove(req: Request, res: Response): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Extract game state from request
      const gameState = this.extractGameState(req);
      
      // Validate game state
      if (!this.isValidGameState(gameState)) {
        res.status(400).json({ error: 'Invalid game state' });
        return;
      }

      // Calculate optimal move
      const move = this.strategy.calculateMove(gameState);
      
      if (!move) {
        res.status(400).json({ error: 'No valid moves available' });
        return;
      }

      // Evaluate confidence
      const confidence = this.calculateConfidence(gameState, move);
      
      // Prepare response
      const response: GameResponse = {
        move,
        confidence,
        reasoning: `Strategy: ${this.strategy.constructor.name}, Confidence: ${confidence}%`
      };

      const processingTime = Date.now() - startTime;
      console.log(`Move calculated in ${processingTime}ms with confidence ${confidence}%`);

      res.status(200).json(response);
    } catch (error) {
      console.error('Error processing move:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Extract game state from request (body, query, or params)
   */
  private extractGameState(req: Request): any {
    // Try body first, then query, then params
    if (req.body && Object.keys(req.body).length > 0) {
      return req.body;
    }
    if (req.query && Object.keys(req.query).length > 0) {
      return req.query;
    }
    if (req.params && Object.keys(req.params).length > 0) {
      return req.params;
    }
    return {};
  }

  /**
   * Validate game state structure
   */
  private isValidGameState(state: any): boolean {
    // TODO: Implement validation based on actual game rules
    return state && typeof state === 'object';
  }

  /**
   * Calculate confidence score for the move (0-100)
   */
  private calculateConfidence(state: any, move: any): number {
    // TODO: Implement confidence calculation
    // Could be based on evaluation difference, win probability, etc.
    return 75; // Placeholder
  }

  /**
   * Update strategy (useful for testing different algorithms)
   */
  setStrategy(strategy: AIStrategy): void {
    this.strategy = strategy;
  }
}
