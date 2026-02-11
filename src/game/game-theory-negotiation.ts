import {
  NegotiateRequest,
  NegotiateResponse,
  Tower,
  CombatAction
} from '../types/kingdom-wars';
import { Logger } from '../utils/logger';

/**
 * Game Theory-based Negotiation Strategy for Kingdom Wars
 * 
 * Implements concepts from:
 * - Prisoner's Dilemma
 * - Tit-for-Tat
 * - Nash Equilibrium
 * - Alliance Formation
 * - Betrayal Detection
 */
export class GameTheoryNegotiation {
  private playerId: number;
  // Track history per game: Map<gameId, Map<playerId, GameHistory>>
  private gameHistories: Map<number, Map<number, GameHistory>> = new Map();
  // Track alliances per game: Map<gameId, Map<playerId, AllianceRecord>>
  private allianceHistories: Map<number, Map<number, AllianceRecord>> = new Map();

  constructor(playerId: number) {
    this.playerId = playerId;
  }

  /**
   * Calculate negotiation strategy using game theory
   */
  calculateNegotiation(request: NegotiateRequest): NegotiateResponse[] {
    const { playerTower, enemyTowers, combatActions, turn, gameId } = request;
    this.playerId = playerTower.playerId;

    // Update game history (per gameId)
    this.updateHistory(gameId, enemyTowers, combatActions, turn);

    // Analyze game state
    const analysis = this.analyzeGameState(gameId, playerTower, enemyTowers, turn, combatActions);

    // Calculate payoffs for different strategies
    const payoffs = this.calculatePayoffs(gameId, playerTower, enemyTowers, analysis);

    // Select best strategy using game theory
    const strategy = this.selectStrategy(gameId, payoffs, analysis, turn);

    // Form response
    const response: NegotiateResponse[] = [];

    if (strategy.allyId) {
      response.push({
        allyId: strategy.allyId,
        attackTargetId: strategy.targetId
      });
    }

    Logger.debug('Game Theory negotiation decision', {
      turn,
      strategy: strategy.type,
      allyId: strategy.allyId,
      targetId: strategy.targetId,
      reasoning: strategy.reasoning
    });

    return response;
  }

  /**
   * Analyze current game state
   */
  private analyzeGameState(
    gameId: number,
    playerTower: Tower,
    enemyTowers: Tower[],
    turn: number,
    combatActions: CombatAction[]
  ): GameAnalysis {
    // Calculate relative strengths
    const playerStrength = playerTower.hp + playerTower.armor + (playerTower.level * 10);
    const enemyStrengths = enemyTowers.map(e => ({
      playerId: e.playerId,
      strength: e.hp + e.armor + (e.level * 10),
      hp: e.hp,
      level: e.level
    }));

    // Identify threats
    const threats = this.identifyThreats(playerTower, enemyTowers, combatActions);

    // Calculate alliance value
    const allianceValues = this.calculateAllianceValues(
      gameId,
      playerTower,
      enemyTowers,
      threats
    );

    // Detect betrayal risk
    const betrayalRisks = this.calculateBetrayalRisk(gameId, enemyTowers, turn);

    return {
      playerStrength,
      enemyStrengths,
      threats,
      allianceValues,
      betrayalRisks,
      turn,
      isEarlyGame: turn < 10,
      isMidGame: turn >= 10 && turn < 25,
      isLateGame: turn >= 25
    };
  }

  /**
   * Identify threats (who is attacking us, who is strong)
   */
  private identifyThreats(
    playerTower: Tower,
    enemyTowers: Tower[],
    combatActions: CombatAction[]
  ): Map<number, ThreatLevel> {
    const threats = new Map<number, ThreatLevel>();

    // Count attacks on us
    const attacksOnUs = new Map<number, number>();
    combatActions.forEach(action => {
      if (action.action?.targetId === playerTower.playerId) {
        const current = attacksOnUs.get(action.playerId) || 0;
        attacksOnUs.set(action.playerId, current + (action.action.troopCount || 0));
      }
    });

    // Calculate threat level for each enemy
    // Skip dead enemies (HP <= 0)
    enemyTowers.forEach(enemy => {
      // Skip dead enemies
      if (enemy.hp <= 0) {
        return;
      }
      
      const attackCount = attacksOnUs.get(enemy.playerId) || 0;
      const strength = enemy.hp + enemy.armor + (enemy.level * 10);
      const threatScore = attackCount * 2 + strength;

      threats.set(enemy.playerId, {
        playerId: enemy.playerId,
        attackCount,
        strength,
        threatScore,
        isAttackingUs: attackCount > 0,
        isStrong: strength > (playerTower.hp + playerTower.armor + (playerTower.level * 10))
      });
    });

    return threats;
  }

  /**
   * Calculate alliance values (how beneficial is allying with each player)
   */
  private calculateAllianceValues(
    gameId: number,
    playerTower: Tower,
    enemyTowers: Tower[],
    threats: Map<number, ThreatLevel>
  ): Map<number, AllianceValue> {
    const values = new Map<number, AllianceValue>();
    const playerStrength = playerTower.hp + playerTower.armor + (playerTower.level * 10);

    enemyTowers.forEach(enemy => {
      // Skip dead enemies (HP <= 0)
      if (enemy.hp <= 0) {
        return;
      }
      
      const threat = threats.get(enemy.playerId);
      const enemyStrength = enemy.hp + enemy.armor + (enemy.level * 10);
      
      // Base value: strength of potential ally
      let value = enemyStrength;

      // Bonus: if they're not a threat to us
      if (threat && !threat.isAttackingUs) {
        value += 50;
      }

      // Bonus: if they're strong (good ally)
      if (enemyStrength > playerStrength * 0.8) {
        value += 30;
      }

      // Penalty: if they're attacking us
      if (threat && threat.isAttackingUs) {
        value -= threat.attackCount * 20;
      }

      // Penalty: if they're too weak (not useful)
      if (enemyStrength < playerStrength * 0.5) {
        value -= 40;
      }

      // Check alliance history (per game)
      const allianceHistory = this.allianceHistories.get(gameId);
      const history = allianceHistory?.get(enemy.playerId);
      if (history) {
        if (history.cooperated) {
          value += 20; // Bonus for previous cooperation
        }
        if (history.betrayed) {
          value -= 50; // Penalty for betrayal
        }
      }

      values.set(enemy.playerId, {
        playerId: enemy.playerId,
        value,
        strength: enemyStrength,
        isThreat: threat?.isAttackingUs || false,
        trustLevel: history ? (history.cooperated ? 0.7 : 0.3) : 0.5
      });
    });

    return values;
  }

  /**
   * Calculate betrayal risk (how likely is each player to betray)
   */
  private calculateBetrayalRisk(
    gameId: number,
    enemyTowers: Tower[],
    turn: number
  ): Map<number, number> {
    const risks = new Map<number, number>();

    enemyTowers.forEach(enemy => {
      // Skip dead enemies
      if (enemy.hp <= 0) {
        return;
      }
      
      let risk = 0.3; // Base betrayal risk

      // Late game: higher betrayal risk
      if (turn >= 25) {
        risk += 0.3;
      }

      // Strong players more likely to betray
      const strength = enemy.hp + enemy.armor + (enemy.level * 10);
      if (strength > 150) {
        risk += 0.2;
      }

      // Check history (per game)
      const allianceHistory = this.allianceHistories.get(gameId);
      const history = allianceHistory?.get(enemy.playerId);
      if (history && history.betrayed) {
        risk += 0.4; // High risk if they've betrayed before
      }

      risks.set(enemy.playerId, Math.min(1.0, risk));
    });

    return risks;
  }

  /**
   * Calculate payoffs for different strategies
   */
  private calculatePayoffs(
    gameId: number,
    playerTower: Tower,
    enemyTowers: Tower[],
    analysis: GameAnalysis
  ): StrategyPayoffs {
    const payoffs: StrategyPayoffs = {
      cooperate: new Map(),
      defect: new Map(),
      titForTat: new Map(),
      betray: new Map()
    };

    // Calculate payoffs for each strategy against each potential ally
    analysis.allianceValues.forEach((allianceValue, playerId) => {
      const threat = analysis.threats.get(playerId);
      const betrayalRisk = analysis.betrayalRisks.get(playerId) || 0.5;

      // Cooperate: Form alliance, don't attack
      const cooperatePayoff = this.calculateCooperatePayoff(
        allianceValue,
        threat,
        analysis
      );
      payoffs.cooperate.set(playerId, cooperatePayoff);

      // Defect: No alliance, attack them
      const defectPayoff = this.calculateDefectPayoff(
        allianceValue,
        threat,
        analysis
      );
      payoffs.defect.set(playerId, defectPayoff);

      // Tit-for-Tat: Cooperate if they cooperated, defect if they defected
      const titForTatPayoff = this.calculateTitForTatPayoff(
        gameId,
        allianceValue,
        threat,
        analysis,
        playerId
      );
      payoffs.titForTat.set(playerId, titForTatPayoff);

      // Betray: Form alliance but attack them anyway
      const betrayPayoff = this.calculateBetrayPayoff(
        allianceValue,
        threat,
        betrayalRisk,
        analysis
      );
      payoffs.betray.set(playerId, betrayPayoff);
    });

    return payoffs;
  }

  /**
   * Calculate payoff for cooperation strategy
   */
  private calculateCooperatePayoff(
    allianceValue: AllianceValue,
    threat: ThreatLevel | undefined,
    analysis: GameAnalysis
  ): number {
    let payoff = allianceValue.value;

    // Bonus: Eliminate mutual threats together
    if (threat && !threat.isAttackingUs) {
      payoff += 30;
    }

    // Bonus: Early game cooperation
    if (analysis.isEarlyGame) {
      payoff += 20;
    }

    // Penalty: Late game (alliances less valuable)
    if (analysis.isLateGame) {
      payoff -= 20;
    }

    return payoff;
  }

  /**
   * Calculate payoff for defection strategy
   */
  private calculateDefectPayoff(
    allianceValue: AllianceValue,
    threat: ThreatLevel | undefined,
    analysis: GameAnalysis
  ): number {
    let payoff = 0;

    // Bonus: Attack high-threat enemies
    if (threat && threat.isAttackingUs) {
      payoff += threat.threatScore * 2;
    }

    // Bonus: Attack weak enemies (easy elimination)
    if (allianceValue.strength < analysis.playerStrength * 0.7) {
      payoff += 40;
    }

    // Penalty: Attack strong enemies (risky)
    if (allianceValue.strength > analysis.playerStrength * 1.2) {
      payoff -= 30;
    }

    return payoff;
  }

  /**
   * Calculate payoff for Tit-for-Tat strategy
   */
  private calculateTitForTatPayoff(
    gameId: number,
    allianceValue: AllianceValue,
    threat: ThreatLevel | undefined,
    analysis: GameAnalysis,
    playerId: number
  ): number {
    const allianceHistory = this.allianceHistories.get(gameId);
    const history = allianceHistory?.get(playerId);
    
    if (!history) {
      // No history: start with cooperation
      return this.calculateCooperatePayoff(allianceValue, threat, analysis);
    }

    if (history.cooperated) {
      // They cooperated: continue cooperating
      return this.calculateCooperatePayoff(allianceValue, threat, analysis) + 10;
    } else {
      // They defected: defect back
      return this.calculateDefectPayoff(allianceValue, threat, analysis);
    }
  }

  /**
   * Calculate payoff for betrayal strategy
   */
  private calculateBetrayPayoff(
    allianceValue: AllianceValue,
    threat: ThreatLevel | undefined,
    betrayalRisk: number,
    analysis: GameAnalysis
  ): number {
    // Betrayal: Get alliance benefits but attack anyway
    let payoff = allianceValue.value * 0.5; // Partial alliance benefit

    // Bonus: Attack weak ally (easy target)
    if (allianceValue.strength < analysis.playerStrength * 0.8) {
      payoff += 50;
    }

    // Penalty: High betrayal risk (they might retaliate)
    payoff -= betrayalRisk * 40;

    // Penalty: Late game (less valuable)
    if (analysis.isLateGame) {
      payoff -= 20;
    }

    return payoff;
  }

  /**
   * Select best strategy using game theory
   */
  private selectStrategy(
    gameId: number,
    payoffs: StrategyPayoffs,
    analysis: GameAnalysis,
    turn: number
  ): NegotiationStrategy {
    // Find best strategy for each potential partner
    const bestStrategies: Array<{
      playerId: number;
      strategy: 'cooperate' | 'defect' | 'titForTat' | 'betray';
      payoff: number;
    }> = [];

    const allPlayerIds = Array.from(analysis.allianceValues.keys());

    allPlayerIds.forEach(playerId => {
      const strategies = [
        { type: 'cooperate' as const, payoff: payoffs.cooperate.get(playerId) || 0 },
        { type: 'defect' as const, payoff: payoffs.defect.get(playerId) || 0 },
        { type: 'titForTat' as const, payoff: payoffs.titForTat.get(playerId) || 0 },
        { type: 'betray' as const, payoff: payoffs.betray.get(playerId) || 0 }
      ];

      const best = strategies.reduce((max, s) => s.payoff > max.payoff ? s : max);
      bestStrategies.push({
        playerId,
        strategy: best.type,
        payoff: best.payoff
      });
    });

    // Select overall best strategy
    const bestOverall = bestStrategies.reduce((max, s) => s.payoff > max.payoff ? s : max);

    // Determine ally and target based on strategy
    let allyId: number | undefined;
    let targetId: number | undefined;
    let reasoning = '';

    switch (bestOverall.strategy) {
      case 'cooperate':
        allyId = bestOverall.playerId;
        // Target highest threat that's not our ally
        const threats = Array.from(analysis.threats.values())
          .filter(t => t.playerId !== allyId)
          .sort((a, b) => b.threatScore - a.threatScore);
        targetId = threats[0]?.playerId;
        reasoning = `Cooperation: Ally with ${allyId}, target mutual threat ${targetId}`;
        break;

      case 'defect':
        // No ally, attack highest threat
        const topThreat = Array.from(analysis.threats.values())
          .sort((a, b) => b.threatScore - a.threatScore)[0];
        targetId = topThreat?.playerId;
        reasoning = `Defection: No alliance, attack highest threat ${targetId}`;
        break;

      case 'titForTat':
        const allianceHistory = this.allianceHistories.get(gameId);
        const history = allianceHistory?.get(bestOverall.playerId);
        if (history && history.cooperated) {
          allyId = bestOverall.playerId;
          const mutualThreats = Array.from(analysis.threats.values())
            .filter(t => t.playerId !== allyId)
            .sort((a, b) => b.threatScore - a.threatScore);
          targetId = mutualThreats[0]?.playerId;
          reasoning = `Tit-for-Tat: Continue cooperation with ${allyId}, target ${targetId}`;
        } else {
          targetId = bestOverall.playerId;
          reasoning = `Tit-for-Tat: Retaliate against ${targetId} for previous defection`;
        }
        break;

      case 'betray':
        allyId = bestOverall.playerId;
        targetId = bestOverall.playerId; // Attack our "ally"
        reasoning = `Betrayal: Form alliance with ${allyId} but attack them (opportunistic)`;
        break;
    }

    return {
      type: bestOverall.strategy,
      allyId,
      targetId,
      reasoning
    };
  }

  /**
   * Update game history (per gameId)
   */
  private updateHistory(
    gameId: number,
    enemyTowers: Tower[],
    combatActions: CombatAction[],
    turn: number
  ): void {
    // Get or create history maps for this game
    if (!this.gameHistories.has(gameId)) {
      this.gameHistories.set(gameId, new Map());
    }
    const gameHistory = this.gameHistories.get(gameId)!;

    // Track which players attacked us
    const attackers = new Set<number>();
    combatActions.forEach(action => {
      if (action.action?.targetId === this.playerId) {
        attackers.add(action.playerId);
      }
    });

    // Update history for each enemy
    // Skip dead enemies (HP <= 0)
    enemyTowers.forEach(enemy => {
      // Skip dead enemies
      if (enemy.hp <= 0) {
        return;
      }
      
      if (!gameHistory.has(enemy.playerId)) {
        gameHistory.set(enemy.playerId, {
          playerId: enemy.playerId,
          attacksOnUs: 0,
          turnsSinceLastAttack: Infinity,
          cooperationCount: 0,
          defectionCount: 0
        });
      }

      const history = gameHistory.get(enemy.playerId)!;
      
      if (attackers.has(enemy.playerId)) {
        history.attacksOnUs++;
        history.turnsSinceLastAttack = 0;
        history.defectionCount++;
      } else {
        history.turnsSinceLastAttack++;
        if (history.turnsSinceLastAttack > 2) {
          history.cooperationCount++;
        }
      }
    });
  }

  /**
   * Update alliance history after negotiation (per gameId)
   */
  updateAllianceHistory(gameId: number, allyId: number | undefined, targetId: number | undefined): void {
    if (allyId) {
      // Get or create alliance history map for this game
      if (!this.allianceHistories.has(gameId)) {
        this.allianceHistories.set(gameId, new Map());
      }
      const allianceHistory = this.allianceHistories.get(gameId)!;

      if (!allianceHistory.has(allyId)) {
        allianceHistory.set(allyId, {
          playerId: allyId,
          cooperated: false,
          betrayed: false,
          allianceTurns: 0
        });
      }

      const record = allianceHistory.get(allyId)!;
      
      // If we're targeting our ally, that's betrayal
      if (targetId === allyId) {
        record.betrayed = true;
        record.cooperated = false;
      } else {
        record.cooperated = true;
        record.allianceTurns++;
      }
    }
  }

  /**
   * Check if player is our ally (has cooperated with us) in specific game
   * Trust system: Give initial trust at beginning (turn 0-1), use history from turn 2+
   */
  isAlly(gameId: number, playerId: number, turn?: number): boolean {
    const allianceHistory = this.allianceHistories.get(gameId);
    if (!allianceHistory) return false;
    const record = allianceHistory.get(playerId);
    
    if (!record) return false;
    
    // Turn 0-1: Give initial trust credit to allies (if we formed alliance)
    if (turn !== undefined && turn <= 1) {
      // If we formed alliance, give initial trust
      if (record.cooperated && !record.betrayed) {
        Logger.debug('Giving initial trust to ally', {
          playerId,
          turn,
          allianceTurns: record.allianceTurns
        });
        return true;
      }
      return false;
    }
    
    // Turn 2+: Use history to determine if ally is true
    // Check if they've cooperated and not betrayed us
    if (record.cooperated && !record.betrayed) {
      // Additional check: if they've attacked us recently, they're not a true ally
      const gameHistory = this.gameHistories.get(gameId);
      const history = gameHistory?.get(playerId);
      if (history && history.turnsSinceLastAttack < 2) {
        // They attacked us recently, not a true ally
        Logger.debug('Ally attacked us recently, not trusting', {
          playerId,
          turnsSinceLastAttack: history.turnsSinceLastAttack
        });
        return false;
      }
      return true;
    }
    
    return false;
  }

  /**
   * Check if player has betrayed us in specific game
   */
  hasBetrayed(gameId: number, playerId: number): boolean {
    const allianceHistory = this.allianceHistories.get(gameId);
    if (!allianceHistory) return false;
    const record = allianceHistory.get(playerId);
    return record ? record.betrayed : false;
  }

  /**
   * Get alliance record for player in specific game
   */
  getAllianceRecord(gameId: number, playerId: number): AllianceRecord | null {
    const allianceHistory = this.allianceHistories.get(gameId);
    return allianceHistory?.get(playerId) || null;
  }

  /**
   * Get game history for player in specific game
   */
  getGameHistory(gameId: number, playerId: number): GameHistory | null {
    const gameHistory = this.gameHistories.get(gameId);
    return gameHistory?.get(playerId) || null;
  }

  /**
   * Get cooperation level (0-1, higher = more cooperative) in specific game
   */
  getCooperationLevel(gameId: number, playerId: number): number {
    const gameHistory = this.gameHistories.get(gameId);
    const history = gameHistory?.get(playerId);
    if (!history) return 0.5; // Neutral if no history
    
    const totalInteractions = history.cooperationCount + history.defectionCount;
    if (totalInteractions === 0) return 0.5;
    
    return history.cooperationCount / totalInteractions;
  }

  /**
   * Predict if enemy will attack us (based on history) in specific game
   */
  willLikelyAttackUs(gameId: number, playerId: number): boolean {
    const gameHistory = this.gameHistories.get(gameId);
    const history = gameHistory?.get(playerId);
    if (!history) return false;
    
    // If they recently attacked us, likely to attack again
    if (history.turnsSinceLastAttack < 2) {
      return true;
    }
    
    // If they have high defection rate, likely to attack
    const cooperationLevel = this.getCooperationLevel(gameId, playerId);
    return cooperationLevel < 0.3;
  }

  /**
   * Clear game-specific data when game is over or bot is killed
   */
  clearGame(gameId: number): void {
    this.gameHistories.delete(gameId);
    this.allianceHistories.delete(gameId);
    Logger.debug('Cleared game data', { gameId });
  }

  /**
   * Clear all game data (for all games)
   */
  clear(): void {
    this.gameHistories.clear();
    this.allianceHistories.clear();
    Logger.debug('Cleared all game data');
  }
}

// Type definitions

interface GameAnalysis {
  playerStrength: number;
  enemyStrengths: Array<{ playerId: number; strength: number; hp: number; level: number }>;
  threats: Map<number, ThreatLevel>;
  allianceValues: Map<number, AllianceValue>;
  betrayalRisks: Map<number, number>;
  turn: number;
  isEarlyGame: boolean;
  isMidGame: boolean;
  isLateGame: boolean;
}

interface ThreatLevel {
  playerId: number;
  attackCount: number;
  strength: number;
  threatScore: number;
  isAttackingUs: boolean;
  isStrong: boolean;
}

interface AllianceValue {
  playerId: number;
  value: number;
  strength: number;
  isThreat: boolean;
  trustLevel: number;
}

interface StrategyPayoffs {
  cooperate: Map<number, number>;
  defect: Map<number, number>;
  titForTat: Map<number, number>;
  betray: Map<number, number>;
}

interface NegotiationStrategy {
  type: 'cooperate' | 'defect' | 'titForTat' | 'betray';
  allyId?: number;
  targetId?: number;
  reasoning: string;
}

interface GameHistory {
  playerId: number;
  attacksOnUs: number;
  turnsSinceLastAttack: number;
  cooperationCount: number;
  defectionCount: number;
}

interface AllianceRecord {
  playerId: number;
  cooperated: boolean;
  betrayed: boolean;
  allianceTurns: number;
}
