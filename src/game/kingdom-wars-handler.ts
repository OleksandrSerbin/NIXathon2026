import { Request, Response } from 'express';
import {
  NegotiateRequest,
  NegotiateResponse,
  CombatRequest,
  CombatResponseAction,
  Tower,
  BotInfo
} from '../types/kingdom-wars';
import { Logger } from '../utils/logger';

/**
 * Kingdom Wars game handler
 * Handles negotiation and combat phases
 */
export class KingdomWarsHandler {
  private botInfo: BotInfo;

  constructor(botInfo?: Partial<BotInfo>) {
    this.botInfo = {
      name: botInfo?.name || 'NIXathon2026 Bot',
      strategy: 'AI-trapped-strategy', // Required by game server
      version: botInfo?.version || '1.0'
    };
  }

  /**
   * Handle negotiation phase
   * POST /negotiate
   */
  async handleNegotiate(req: Request, res: Response): Promise<void> {
    // Required logging
    console.log('[KW-BOT] Mega ogudor');
    
    try {
      const startTime = Date.now();
      const request: NegotiateRequest = req.body;

      // Log incoming request
      Logger.requestIncoming(
        'POST /negotiate',
        request.gameId,
        request.turn,
        request.playerTower.playerId
      );

      // Log full request body
      Logger.requestBody('POST /negotiate', {
        gameId: request.gameId,
        turn: request.turn,
        playerTower: request.playerTower,
        enemyTowers: request.enemyTowers,
        combatActions: request.combatActions
      });

      // Validate request
      if (!this.isValidNegotiateRequest(request)) {
        Logger.warn('Invalid negotiation request', request);
        res.status(400).json({ error: 'Invalid negotiation request' });
        return;
      }

      // Calculate negotiation strategy with detailed logging
      const { response, threats, bestAlly, bestTarget } = this.calculateNegotiationWithLogging(request);

      const processingTime = Date.now() - startTime;
      
      // Log decision details
      Logger.negotiationDecision(
        request.gameId,
        request.turn,
        threats,
        bestAlly,
        bestTarget,
        response
      );

      // Log outgoing response
      Logger.responseOutgoing('POST /negotiate', 200, response, processingTime);

      res.status(200).json(response);
    } catch (error) {
      Logger.error('[KW-BOT] Negotiation error', error);
      console.error('[KW-BOT] Negotiation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle combat phase
   * POST /combat
   */
  async handleCombat(req: Request, res: Response): Promise<void> {
    // Required logging
    console.log('[KW-BOT] Mega ogudor');
    
    try {
      const startTime = Date.now();
      const request: CombatRequest = req.body;

      // Log incoming request
      Logger.requestIncoming(
        'POST /combat',
        request.gameId,
        request.turn,
        request.playerTower.playerId
      );

      // Log full request body
      Logger.requestBody('POST /combat', {
        gameId: request.gameId,
        turn: request.turn,
        playerTower: request.playerTower,
        enemyTowers: request.enemyTowers,
        diplomacy: request.diplomacy,
        previousAttacks: request.previousAttacks
      });

      // Validate request
      if (!this.isValidCombatRequest(request)) {
        Logger.warn('Invalid combat request', request);
        res.status(400).json({ error: 'Invalid combat request' });
        return;
      }

      // Calculate combat actions with detailed logging
      const startResources = request.playerTower.resources || 0;
      const { actions, resourceUsage } = this.calculateCombatActionsWithLogging(request);

      const processingTime = Date.now() - startTime;
      
      // Log decision details
      Logger.combatDecision(
        request.gameId,
        request.turn,
        request.playerTower,
        actions,
        {
          start: startResources,
          end: resourceUsage.remaining,
          spent: resourceUsage.spent
        }
      );

      // Log outgoing response
      Logger.responseOutgoing('POST /combat', 200, actions, processingTime);

      res.status(200).json(actions);
    } catch (error) {
      Logger.error('[KW-BOT] Combat error', error);
      console.error('[KW-BOT] Combat error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get bot metadata
   * GET /info
   */
  getBotInfo(req: Request, res: Response): void {
    res.status(200).json(this.botInfo);
  }

  /**
   * Calculate negotiation strategy (with logging)
   */
  private calculateNegotiationWithLogging(request: NegotiateRequest): {
    response: NegotiateResponse[];
    threats: Map<number, number>;
    bestAlly: Tower | null;
    bestTarget: Tower | null;
  } {
    const { playerTower, enemyTowers, combatActions } = request;
    
    // Analyze threats
    const threats = this.analyzeThreats(playerTower, enemyTowers, combatActions);
    Logger.debug('Threat analysis', {
      threats: Object.fromEntries(threats),
      playerTower: { playerId: playerTower.playerId, hp: playerTower.hp, armor: playerTower.armor }
    });
    
    // Find best ally (strongest non-threat)
    const bestAlly = this.findBestAlly(enemyTowers, threats);
    Logger.debug('Best ally selected', bestAlly ? {
      playerId: bestAlly.playerId,
      hp: bestAlly.hp,
      level: bestAlly.level,
      threatLevel: threats.get(bestAlly.playerId) || 0
    } : null);
    
    // Find best target (weakest threat)
    const bestTarget = this.findBestTarget(enemyTowers, threats);
    Logger.debug('Best target selected', bestTarget ? {
      playerId: bestTarget.playerId,
      hp: bestTarget.hp,
      level: bestTarget.level,
      threatLevel: threats.get(bestTarget.playerId) || 0
    } : null);
    
    const response: NegotiateResponse[] = [];
    
    if (bestAlly) {
      response.push({
        allyId: bestAlly.playerId,
        attackTargetId: bestTarget?.playerId
      });
    }
    
    return { response, threats, bestAlly, bestTarget };
  }

  /**
   * Calculate negotiation strategy (legacy method for compatibility)
   */
  private calculateNegotiation(request: NegotiateRequest): NegotiateResponse[] {
    return this.calculateNegotiationWithLogging(request).response;
  }

  /**
   * Calculate combat actions (with logging)
   */
  private calculateCombatActionsWithLogging(request: CombatRequest): {
    actions: CombatResponseAction[];
    resourceUsage: { start: number; remaining: number; spent: number };
  } {
    const { playerTower, enemyTowers, turn } = request;
    const actions: CombatResponseAction[] = [];
    const startResources = playerTower.resources || 0;
    let remainingResources = startResources;
    
    Logger.debug('Combat decision start', {
      resources: remainingResources,
      hp: playerTower.hp,
      armor: playerTower.armor,
      level: playerTower.level,
      turn
    });
    
    // Check if we can and should upgrade
    const upgradeCost = this.getUpgradeCost(playerTower.level);
    const shouldUpgrade = this.shouldUpgrade(playerTower, enemyTowers, turn);
    Logger.debug('Upgrade evaluation', {
      upgradeCost,
      canAfford: remainingResources >= upgradeCost,
      shouldUpgrade,
      reason: shouldUpgrade ? 'Meets upgrade criteria' : 'Does not meet upgrade criteria'
    });
    
    if (remainingResources >= upgradeCost && shouldUpgrade) {
      actions.push({ type: 'upgrade' });
      remainingResources -= upgradeCost;
      Logger.debug('Upgrade action added', { cost: upgradeCost, remaining: remainingResources });
    }
    
    // Check if we need armor (low HP or late game)
    const shouldArmor = this.shouldBuildArmor(playerTower, turn);
    Logger.debug('Armor evaluation', {
      shouldBuildArmor: shouldArmor,
      hp: playerTower.hp,
      armor: playerTower.armor,
      turn,
      isLateGame: turn >= 25
    });
    
    if (shouldArmor) {
      const armorAmount = Math.min(10, remainingResources);
      if (armorAmount > 0) {
        actions.push({ type: 'armor', amount: armorAmount });
        remainingResources -= armorAmount;
        Logger.debug('Armor action added', { amount: armorAmount, remaining: remainingResources });
      }
    }
    
    // Attack weakest enemy if we have resources
    if (remainingResources > 0) {
      const target = this.findBestAttackTarget(enemyTowers, playerTower);
      Logger.debug('Attack target evaluation', target ? {
        targetId: target.playerId,
        targetHp: target.hp,
        targetArmor: target.armor,
        availableResources: remainingResources
      } : 'No valid target');
      
      if (target) {
        const attackAmount = Math.min(remainingResources, 30); // Reasonable attack size
        if (attackAmount > 0) {
          actions.push({
            type: 'attack',
            targetId: target.playerId,
            troopCount: attackAmount
          });
          remainingResources -= attackAmount;
          Logger.debug('Attack action added', {
            targetId: target.playerId,
            troopCount: attackAmount,
            remaining: remainingResources
          });
        }
      }
    }
    
    const resourceUsage = {
      start: startResources,
      remaining: remainingResources,
      spent: startResources - remainingResources
    };
    
    Logger.debug('Combat actions summary', {
      actionCount: actions.length,
      resourceUsage
    });
    
    return { actions, resourceUsage };
  }

  /**
   * Calculate combat actions (legacy method for compatibility)
   */
  private calculateCombatActions(request: CombatRequest): CombatResponseAction[] {
    return this.calculateCombatActionsWithLogging(request).actions;
  }

  // Helper methods

  private analyzeThreats(
    playerTower: Tower,
    enemyTowers: Tower[],
    combatActions: any[]
  ): Map<number, number> {
    const threats = new Map<number, number>();
    
    // Count attacks on us
    combatActions.forEach(action => {
      if (action.action?.targetId === playerTower.playerId) {
        const current = threats.get(action.playerId) || 0;
        threats.set(action.playerId, current + (action.action.troopCount || 0));
      }
    });
    
    // Add threat based on enemy strength
    enemyTowers.forEach(enemy => {
      const current = threats.get(enemy.playerId) || 0;
      const threatLevel = enemy.hp + enemy.armor + (enemy.level * 10);
      threats.set(enemy.playerId, current + threatLevel);
    });
    
    return threats;
  }

  private findBestAlly(
    enemyTowers: Tower[],
    threats: Map<number, number>
  ): Tower | null {
    // Find strongest enemy that isn't a major threat
    let bestAlly: Tower | null = null;
    let bestScore = -Infinity;
    
    enemyTowers.forEach(enemy => {
      const threatLevel = threats.get(enemy.playerId) || 0;
      // Prefer strong allies with low threat to us
      const score = enemy.hp + enemy.level * 10 - threatLevel;
      if (score > bestScore) {
        bestScore = score;
        bestAlly = enemy;
      }
    });
    
    return bestAlly;
  }

  private findBestTarget(
    enemyTowers: Tower[],
    threats: Map<number, number>
  ): Tower | null {
    // Find weakest high-threat enemy
    let bestTarget: Tower | null = null;
    let bestScore = Infinity;
    
    enemyTowers.forEach(enemy => {
      const threatLevel = threats.get(enemy.playerId) || 0;
      // Prioritize high-threat, low-HP enemies
      const score = enemy.hp - threatLevel * 2;
      if (score < bestScore) {
        bestScore = score;
        bestTarget = enemy;
      }
    });
    
    return bestTarget;
  }

  private shouldUpgrade(
    playerTower: Tower,
    enemyTowers: Tower[],
    turn: number
  ): boolean {
    // Upgrade if:
    // 1. We have enough resources
    // 2. We're not in immediate danger (HP > 50)
    // 3. Early-mid game (turn < 20) OR we're behind in level
    
    const avgEnemyLevel = enemyTowers.reduce((sum, e) => sum + e.level, 0) / enemyTowers.length;
    const isBehind = playerTower.level < avgEnemyLevel;
    const isSafe = playerTower.hp > 50;
    const isEarlyGame = turn < 20;
    
    return (isEarlyGame || isBehind) && isSafe;
  }

  private shouldBuildArmor(playerTower: Tower, turn: number): boolean {
    // Build armor if:
    // 1. HP is low (< 60)
    // 2. Late game (turn >= 25, fatigue damage)
    // 3. Armor is low (< 10)
    
    const isLowHP = playerTower.hp < 60;
    const isLateGame = turn >= 25;
    const isLowArmor = playerTower.armor < 10;
    
    return (isLowHP || isLateGame) && isLowArmor;
  }

  private findBestAttackTarget(
    enemyTowers: Tower[],
    playerTower: Tower
  ): Tower | null {
    // Attack weakest enemy (lowest HP + armor)
    let bestTarget: Tower | null = null;
    let bestScore = Infinity;
    
    enemyTowers.forEach(enemy => {
      const score = enemy.hp + enemy.armor;
      if (score < bestScore) {
        bestScore = score;
        bestTarget = enemy;
      }
    });
    
    return bestTarget;
  }

  private getUpgradeCost(level: number): number {
    // Cost: 50 × (1.75 ^ (level - 1))
    return Math.floor(50 * Math.pow(1.75, level - 1));
  }

  private isValidNegotiateRequest(request: any): boolean {
    return (
      request &&
      typeof request.gameId === 'number' &&
      typeof request.turn === 'number' &&
      request.playerTower &&
      Array.isArray(request.enemyTowers)
    );
  }

  private isValidCombatRequest(request: any): boolean {
    return (
      request &&
      typeof request.gameId === 'number' &&
      typeof request.turn === 'number' &&
      request.playerTower &&
      Array.isArray(request.enemyTowers)
    );
  }
}
