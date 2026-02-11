/**
 * Enhanced logger utility for debugging and monitoring
 */
export class Logger {
  private static enabled: boolean = process.env.NODE_ENV !== 'production' || process.env.ENABLE_LOGGING === 'true';
  private static logLevel: string = process.env.LOG_LEVEL || 'info';

  private static shouldLog(level: string): boolean {
    if (!this.enabled) return false;
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevel = levels.indexOf(this.logLevel);
    const messageLevel = levels.indexOf(level);
    return messageLevel >= currentLevel;
  }

  private static formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    if (data) {
      return `${prefix} ${message} ${JSON.stringify(data, null, 2)}`;
    }
    return `${prefix} ${message}`;
  }

  static debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  static log(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, data));
    }
  }

  static info(message: string, data?: any): void {
    this.log(message, data);
  }

  static warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  static error(message: string, error?: any): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR] ${message}`, error || '');
  }

  // Kingdom Wars specific logging
  static requestIncoming(endpoint: string, gameId: number, turn: number, playerId: number): void {
    this.log(`[REQUEST] ${endpoint}`, {
      gameId,
      turn,
      playerId,
      timestamp: new Date().toISOString()
    });
  }

  static requestBody(endpoint: string, body: any): void {
    this.debug(`[REQUEST BODY] ${endpoint}`, body);
  }

  static responseOutgoing(endpoint: string, statusCode: number, response: any, timeMs: number): void {
    this.log(`[RESPONSE] ${endpoint}`, {
      statusCode,
      timeMs: `${timeMs}ms`,
      responseSize: JSON.stringify(response).length,
      response: response
    });
  }

  static negotiationDecision(
    gameId: number,
    turn: number,
    threats: Map<number, number>,
    bestAlly: any,
    bestTarget: any,
    response: any[]
  ): void {
    this.log(`[NEGOTIATION] Decision`, {
      gameId,
      turn,
      threats: Object.fromEntries(threats),
      bestAlly: bestAlly ? { playerId: bestAlly.playerId, hp: bestAlly.hp, level: bestAlly.level } : null,
      bestTarget: bestTarget ? { playerId: bestTarget.playerId, hp: bestTarget.hp, level: bestTarget.level } : null,
      response
    });
  }

  static combatDecision(
    gameId: number,
    turn: number,
    playerTower: any,
    actions: any[],
    resourceUsage: { start: number; end: number; spent: number }
  ): void {
    this.log(`[COMBAT] Decision`, {
      gameId,
      turn,
      playerState: {
        playerId: playerTower.playerId,
        hp: playerTower.hp,
        armor: playerTower.armor,
        resources: playerTower.resources,
        level: playerTower.level
      },
      actions,
      resourceUsage
    });
  }

  static gameState(state: any): void {
    this.debug('Game State Received:', state);
  }

  static moveCalculated(move: any, confidence: number, timeMs: number): void {
    this.log(`Move Calculated:`, {
      move,
      confidence: `${confidence}%`,
      time: `${timeMs}ms`
    });
  }

  static performance(operation: string, timeMs: number, details?: any): void {
    this.log(`[PERFORMANCE] ${operation}`, {
      timeMs: `${timeMs}ms`,
      ...details
    });
  }
}
