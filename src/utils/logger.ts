/**
 * Simple logger utility for debugging and monitoring
 */
export class Logger {
  private static enabled: boolean = process.env.NODE_ENV !== 'production' || process.env.ENABLE_LOGGING === 'true';

  static log(message: string, data?: any): void {
    if (this.enabled) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${message}`, data || '');
    }
  }

  static error(message: string, error?: any): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR: ${message}`, error || '');
  }

  static gameState(state: any): void {
    if (this.enabled) {
      this.log('Game State Received:', JSON.stringify(state, null, 2));
    }
  }

  static moveCalculated(move: any, confidence: number, timeMs: number): void {
    if (this.enabled) {
      this.log(`Move Calculated:`, {
        move,
        confidence: `${confidence}%`,
        time: `${timeMs}ms`
      });
    }
  }
}
