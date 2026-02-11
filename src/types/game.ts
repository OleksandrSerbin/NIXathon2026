// Game state and move types
export interface GameState {
  [key: string]: any; // Will be defined based on actual game rules
}

export interface GameMove {
  [key: string]: any; // Will be defined based on actual game rules
}

export interface GameRequest {
  body?: GameState;
  query?: Record<string, string>;
  params?: Record<string, string>;
}

export interface GameResponse {
  move: GameMove;
  confidence?: number;
  reasoning?: string;
}
