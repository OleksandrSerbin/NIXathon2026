import { GameState, GameMove } from '../types/game';
import { TimeManager } from '../utils/time-manager';

/**
 * Base interface for AI strategies
 */
export interface AIStrategy {
  calculateMove(state: GameState): GameMove | null;
  evaluate(state: GameState): number;
}

/**
 * Minimax algorithm with Alpha-Beta Pruning for two-player games
 * 
 * Optimized for perfect-information games like Connect Four, Tic-tac-toe, etc.
 * Features:
 * - Alpha-Beta Pruning (50-90% faster than regular minimax)
 * - Transposition Table (caches evaluated positions)
 * - Iterative Deepening (time-aware search)
 * - Immediate win/block detection
 */
export class MinimaxStrategy implements AIStrategy {
  private maxDepth: number;
  private isMaximizing: boolean;
  private transpositionTable: Map<string, number>;
  private timeManager?: TimeManager;
  private useIterativeDeepening: boolean;

  constructor(
    maxDepth: number = 8,
    isMaximizing: boolean = true,
    timeLimitMs?: number,
    useIterativeDeepening: boolean = true
  ) {
    this.maxDepth = maxDepth;
    this.isMaximizing = isMaximizing;
    this.transpositionTable = new Map();
    this.useIterativeDeepening = useIterativeDeepening;
    
    if (timeLimitMs) {
      this.timeManager = new TimeManager(timeLimitMs, timeLimitMs * 0.8);
    }
  }

  calculateMove(state: GameState): GameMove | null {
    this.transpositionTable.clear();
    if (this.timeManager) {
      this.timeManager.reset();
    }

    const possibleMoves = this.getPossibleMoves(state);
    if (possibleMoves.length === 0) return null;

    // Check for immediate winning move (optimization)
    for (const move of possibleMoves) {
      const newState = this.applyMove(state, move);
      if (this.isWinningMove(newState)) {
        return move; // Instant win
      }
    }

    // Use iterative deepening if enabled (better time management)
    if (this.useIterativeDeepening) {
      return this.calculateMoveWithIterativeDeepening(state, possibleMoves);
    } else {
      return this.calculateMoveFixedDepth(state, possibleMoves);
    }
  }

  private calculateMoveWithIterativeDeepening(
    state: GameState,
    possibleMoves: GameMove[]
  ): GameMove | null {
    let bestMove: GameMove | null = null;
    let bestScore = this.isMaximizing ? -Infinity : Infinity;

    // Start shallow, go deeper if time allows
    for (let depth = 2; depth <= this.maxDepth; depth++) {
      if (this.timeManager && this.timeManager.shouldStop()) {
        break; // Return best move found so far
      }

      let currentBestMove: GameMove | null = null;
      let currentBestScore = this.isMaximizing ? -Infinity : Infinity;

      for (const move of possibleMoves) {
        if (this.timeManager && this.timeManager.isTimeout()) {
          break;
        }

        const newState = this.applyMove(state, move);
        const score = this.alphaBeta(
          newState,
          depth - 1,
          -Infinity,
          Infinity,
          !this.isMaximizing
        );

        if (this.isMaximizing && score > currentBestScore) {
          currentBestScore = score;
          currentBestMove = move;
        } else if (!this.isMaximizing && score < currentBestScore) {
          currentBestScore = score;
          currentBestMove = move;
        }
      }

      if (currentBestMove) {
        bestMove = currentBestMove;
        bestScore = currentBestScore;
      }
    }

    return bestMove || possibleMoves[0]; // Fallback to first move
  }

  private calculateMoveFixedDepth(
    state: GameState,
    possibleMoves: GameMove[]
  ): GameMove | null {
    let bestMove: GameMove | null = null;
    let bestScore = this.isMaximizing ? -Infinity : Infinity;

    for (const move of possibleMoves) {
      if (this.timeManager && this.timeManager.isTimeout()) {
        break;
      }

      const newState = this.applyMove(state, move);
      const score = this.alphaBeta(
        newState,
        this.maxDepth - 1,
        -Infinity,
        Infinity,
        !this.isMaximizing
      );

      if (this.isMaximizing && score > bestScore) {
        bestScore = score;
        bestMove = move;
      } else if (!this.isMaximizing && score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove || possibleMoves[0];
  }

  /**
   * Alpha-Beta Pruning Minimax - much faster than regular minimax
   * Prunes branches that won't affect the final decision
   */
  private alphaBeta(
    state: GameState,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean
  ): number {
    // Time check
    if (this.timeManager && this.timeManager.isTimeout()) {
      return this.evaluate(state);
    }

    // Check transposition table (position caching)
    const stateKey = this.getStateKey(state);
    if (this.transpositionTable.has(stateKey)) {
      return this.transpositionTable.get(stateKey)!;
    }

    // Terminal conditions
    if (depth === 0 || this.isTerminal(state)) {
      const score = this.evaluate(state);
      this.transpositionTable.set(stateKey, score);
      return score;
    }

    const possibleMoves = this.getPossibleMoves(state);
    if (possibleMoves.length === 0) {
      const score = this.evaluate(state);
      this.transpositionTable.set(stateKey, score);
      return score;
    }

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const move of possibleMoves) {
        const newState = this.applyMove(state, move);
        const score = this.alphaBeta(newState, depth - 1, alpha, beta, false);
        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, score);
        
        // Alpha-beta pruning - cut off this branch
        if (beta <= alpha) {
          break; // Prune remaining moves
        }
      }
      this.transpositionTable.set(stateKey, maxScore);
      return maxScore;
    } else {
      let minScore = Infinity;
      for (const move of possibleMoves) {
        const newState = this.applyMove(state, move);
        const score = this.alphaBeta(newState, depth - 1, alpha, beta, true);
        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);
        
        // Alpha-beta pruning - cut off this branch
        if (beta <= alpha) {
          break; // Prune remaining moves
        }
      }
      this.transpositionTable.set(stateKey, minScore);
      return minScore;
    }
  }

  evaluate(state: GameState): number {
    // TODO: Implement evaluation function based on game rules
    // Return positive for good positions, negative for bad positions
    return 0;
  }

  private getPossibleMoves(state: GameState): GameMove[] {
    // TODO: Implement based on game rules
    return [];
  }

  private applyMove(state: GameState, move: GameMove): GameState {
    // TODO: Implement based on game rules
    return { ...state };
  }

  private isTerminal(state: GameState): boolean {
    // TODO: Implement based on game rules
    return false;
  }

  /**
   * Check if this state represents a winning position
   * Override in subclasses or implement based on game rules
   */
  protected isWinningMove(state: GameState): boolean {
    // TODO: Implement based on game rules
    // Check if current player has won
    return false;
  }

  /**
   * Generate a unique key for state (for transposition table)
   */
  private getStateKey(state: GameState): string {
    // TODO: Create efficient state representation
    // For now, use JSON (can be optimized with bitboards, etc.)
    return JSON.stringify(state);
  }
}

/**
 * Monte Carlo Tree Search (MCTS) for games with uncertainty
 */
export class MCTSStrategy implements AIStrategy {
  private iterations: number;
  private explorationConstant: number;

  constructor(iterations: number = 1000, explorationConstant: number = 1.41) {
    this.iterations = iterations;
    this.explorationConstant = explorationConstant;
  }

  calculateMove(state: GameState): GameMove | null {
    // TODO: Implement MCTS algorithm
    // This is a placeholder structure
    const possibleMoves = this.getPossibleMoves(state);
    if (possibleMoves.length === 0) return null;

    // For now, return random move (replace with MCTS)
    return possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
  }

  evaluate(state: GameState): number {
    // TODO: Implement evaluation
    return 0;
  }

  private getPossibleMoves(state: GameState): GameMove[] {
    // TODO: Implement based on game rules
    return [];
  }
}

/**
 * Greedy strategy - picks the move with immediate best evaluation
 */
export class GreedyStrategy implements AIStrategy {
  calculateMove(state: GameState): GameMove | null {
    const possibleMoves = this.getPossibleMoves(state);
    if (possibleMoves.length === 0) return null;

    let bestMove: GameMove | null = null;
    let bestScore = -Infinity;

    for (const move of possibleMoves) {
      const newState = this.applyMove(state, move);
      const score = this.evaluate(newState);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  evaluate(state: GameState): number {
    // TODO: Implement evaluation function
    return 0;
  }

  private getPossibleMoves(state: GameState): GameMove[] {
    // TODO: Implement based on game rules
    return [];
  }

  private applyMove(state: GameState, move: GameMove): GameState {
    // TODO: Implement based on game rules
    return { ...state };
  }
}
