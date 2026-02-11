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
import { MCTSKingdomWars } from './mcts-kingdom-wars';
import { GameTheoryNegotiation } from './game-theory-negotiation';
import { EnemyResourceTracker } from './enemy-resource-tracker';
import { MultiTurnPlanner } from './multi-turn-planner';

/**
 * Kingdom Wars game handler
 * Handles negotiation and combat phases
 */
export class KingdomWarsHandler {
  private botInfo: BotInfo;
  private useMCTS: boolean;
  private useGameTheory: boolean;
  private useLookahead: boolean;
  private mcts: MCTSKingdomWars | null = null;
  private gameTheory: GameTheoryNegotiation | null = null;
  private resourceTracker: EnemyResourceTracker;
  private lookaheadPlanner: MultiTurnPlanner;

  constructor(botInfo?: Partial<BotInfo>, useMCTS: boolean = true) {
    this.botInfo = {
      name: botInfo?.name || 'NIXathon2026 Bot',
      strategy: 'AI-trapped-strategy', // Required by game server
      version: botInfo?.version || '1.0'
    };
    
    // Enable all features by default
    this.useMCTS = useMCTS !== false; // Default: enabled
    this.useGameTheory = true; // Always enabled
    this.useLookahead = true; // Always enabled
    
    // Initialize MCTS with optimized settings
    const iterations = 500;
    const timeLimit = 800;
    this.mcts = new MCTSKingdomWars(iterations, 1.41, timeLimit);
    Logger.log('MCTS enabled for combat phase', { iterations, timeLimit });

    // Game Theory will be initialized with player ID from first request
    Logger.log('Game Theory enabled for negotiation phase');

    // Initialize resource tracker
    this.resourceTracker = new EnemyResourceTracker();
    Logger.log('Enemy Resource Tracker enabled');

    // Initialize lookahead planner with optimized settings
    const maxTurns = 3;
    this.lookaheadPlanner = new MultiTurnPlanner(maxTurns, this.resourceTracker);
    Logger.log('Multi-turn lookahead enabled', { maxTurns });
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

      // Filter out dead players (HP <= 0) from all planning
      const aliveEnemies = this.filterAliveEnemies(request.enemyTowers);
      if (aliveEnemies.length !== request.enemyTowers.length) {
        Logger.debug('Filtered out dead enemies', {
          original: request.enemyTowers.length,
          alive: aliveEnemies.length,
          dead: request.enemyTowers.filter(e => e.hp <= 0).map(e => e.playerId)
        });
      }

      // Update resource tracking (only for alive enemies)
      this.resourceTracker.updateEstimates(
        request.gameId,
        request.turn,
        aliveEnemies,
        request.combatActions,
        []
      );

      // Log resource estimates
      const resourceEstimates = this.resourceTracker.getAllEstimatesForGame(request.gameId);
      Logger.debug('Enemy resource estimates', {
        estimates: Array.from(resourceEstimates.entries()).map(([id, est]) => ({
          playerId: id,
          estimatedResources: est.estimatedResources,
          resourceGeneration: est.resourceGeneration,
          level: est.lastKnownLevel
        }))
      });

      // Create request with only alive enemies for planning
      const planningRequest = {
        ...request,
        enemyTowers: aliveEnemies
      };

      // Calculate negotiation strategy (use Game Theory if enabled, otherwise heuristic)
      let response: NegotiateResponse[];
      let threats: Map<number, number>;
      let bestAlly: Tower | null = null;
      let bestTarget: Tower | null = null;

      if (this.useGameTheory) {
        // Initialize game theory if needed
        if (!this.gameTheory) {
          this.gameTheory = new GameTheoryNegotiation(request.playerTower.playerId);
        }

        Logger.log('Using Game Theory for negotiation', {
          gameId: request.gameId,
          turn: request.turn
        });

        response = this.gameTheory.calculateNegotiation(planningRequest);
        
        // Extract ally and target from response for logging
        if (response.length > 0) {
          const allyId = response[0].allyId;
          const targetId = response[0].attackTargetId;
          if (allyId) {
            bestAlly = aliveEnemies.find(e => e.playerId === allyId) || null;
          }
          if (targetId) {
            bestTarget = aliveEnemies.find(e => e.playerId === targetId) || null;
          }
        }

        // Calculate threats for logging (only alive enemies)
        threats = this.analyzeThreats(request.playerTower, aliveEnemies, request.combatActions);

        // Update alliance history
        if (response.length > 0) {
          this.gameTheory.updateAllianceHistory(
            request.gameId,
            response[0].allyId,
            response[0].attackTargetId
          );
        }
      } else {
        // Use heuristic approach (with alive enemies only)
        const result = this.calculateNegotiationWithLogging(planningRequest);
        response = result.response;
        threats = result.threats;
        bestAlly = result.bestAlly;
        bestTarget = result.bestTarget;
      }

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

      // Filter out dead players (HP <= 0) from all planning
      const aliveEnemies = this.filterAliveEnemies(request.enemyTowers);
      if (aliveEnemies.length !== request.enemyTowers.length) {
        Logger.debug('Filtered out dead enemies from combat planning', {
          original: request.enemyTowers.length,
          alive: aliveEnemies.length,
          dead: request.enemyTowers.filter(e => e.hp <= 0).map(e => e.playerId)
        });
      }

      // Update resource tracking (only for alive enemies)
      this.resourceTracker.updateEstimates(
        request.gameId,
        request.turn,
        aliveEnemies,
        [],
        request.previousAttacks
      );

      // Use resource estimates for planning
      const resourceEstimates = this.resourceTracker.getAllEstimatesForGame(request.gameId);
      Logger.debug('Enemy resource estimates for combat', {
        estimates: Array.from(resourceEstimates.entries()).map(([id, est]) => ({
          playerId: id,
          estimatedResources: est.estimatedResources,
          canUpgrade: this.resourceTracker.canAffordUpgradeForGame(request.gameId, id),
          expectedAttackSize: est.spendingPattern.avgAttackSize || est.resourceGeneration * 0.5
        }))
      });

      // Create request with only alive enemies for planning
      const planningRequest = {
        ...request,
        enemyTowers: aliveEnemies
      };

      // Calculate combat actions (use MCTS, lookahead, or heuristic)
      const startResources = request.playerTower.resources || 0;
      let actions: CombatResponseAction[];
      let resourceUsage: { start: number; remaining: number; spent: number };
      
      if (this.useMCTS && this.mcts) {
        Logger.log('Using MCTS for combat decision', {
          gameId: request.gameId,
          turn: request.turn
        });
        const mctsActions = this.mcts.calculateBestActions(planningRequest);
        const spent = mctsActions.reduce((sum, action) => {
          return sum + this.getActionCost(action, request.playerTower.level);
        }, 0);
        actions = mctsActions;
        resourceUsage = {
          start: startResources,
          remaining: startResources - spent,
          spent
        };
      } else if (this.useLookahead) {
        Logger.log('Using multi-turn lookahead for combat decision', {
          gameId: request.gameId,
          turn: request.turn
        });
        
        // Generate possible action combinations (with alive enemies only)
        const possibleActions = this.generateActionCombinations(planningRequest);
        
        // Use lookahead planner to evaluate
        const plannedActions = this.lookaheadPlanner.planCombatActions(planningRequest, possibleActions);
        const spent = plannedActions.reduce((sum, action) => {
          return sum + this.getActionCost(action, request.playerTower.level);
        }, 0);
        actions = plannedActions;
        resourceUsage = {
          start: startResources,
          remaining: startResources - spent,
          spent
        };
      } else {
        // Use heuristic approach (with alive enemies only)
        const result = this.calculateCombatActionsWithLogging(planningRequest);
        actions = result.actions;
        resourceUsage = result.resourceUsage;
      }

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
    
    // Check if we can and should upgrade (using multi-turn lookahead)
    const upgradeCost = this.getUpgradeCost(playerTower.level);
    const shouldUpgrade = this.shouldUpgradeWithLookahead(request, remainingResources, upgradeCost);
    Logger.debug('Upgrade evaluation (with lookahead)', {
      upgradeCost,
      canAfford: remainingResources >= upgradeCost,
      shouldUpgrade,
      currentResources: remainingResources,
      currentHP: playerTower.hp,
      currentLevel: playerTower.level
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
    
      // Attack best target using resource estimates and Game Theory history
    if (remainingResources > 0) {
      const target = this.findBestAttackTargetWithHistory(
        request.gameId,
        enemyTowers, 
        playerTower,
        this.resourceTracker,
        this.gameTheory
      );
      Logger.debug('Attack target evaluation (with history and resources)', target ? {
        targetId: target.playerId,
        targetHp: target.hp,
        targetArmor: target.armor,
        availableResources: remainingResources,
        enemyEstimate: this.resourceTracker.getEstimateForGame(request.gameId, target.playerId),
        isAlly: this.gameTheory?.isAlly(request.gameId, target.playerId) || false,
        hasBetrayed: this.gameTheory?.hasBetrayed(request.gameId, target.playerId) || false,
        cooperationLevel: this.gameTheory?.getCooperationLevel(request.gameId, target.playerId) || 0.5
      } : 'No valid target');
      
      if (target) {
        // Use resource estimates and history to determine optimal attack size
        const attackAmount = this.calculateOptimalAttackSize(
          request.gameId,
          target,
          remainingResources,
          this.resourceTracker,
          this.gameTheory
        );
        if (attackAmount > 0) {
          actions.push({
            type: 'attack',
            targetId: target.playerId,
            troopCount: attackAmount
          });
          remainingResources -= attackAmount;
          Logger.debug('Attack action added (resource-based)', {
            targetId: target.playerId,
            troopCount: attackAmount,
            remaining: remainingResources,
            reason: 'Using enemy resource estimates for optimal targeting'
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
    // Skip dead enemies (HP <= 0)
    let bestAlly: Tower | null = null;
    let bestScore = -Infinity;
    
    enemyTowers.forEach(enemy => {
      // Skip dead enemies
      if (enemy.hp <= 0) {
        return;
      }
      
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
      // Skip dead enemies
      if (enemy.hp <= 0) {
        return;
      }
      
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

  /**
   * Determine if we should upgrade using multi-turn lookahead prediction
   */
  private shouldUpgradeWithLookahead(
    request: CombatRequest,
    availableResources: number,
    upgradeCost: number
  ): boolean {
    const { playerTower, enemyTowers, turn } = request;
    
    // Basic safety check: must have enough resources and HP
    if (availableResources < upgradeCost || playerTower.hp <= 50) {
      return false;
    }

    // Use multi-turn lookahead to predict future state
    if (this.useLookahead && this.lookaheadPlanner) {
      // Predict future state WITHOUT upgrading
      const futureWithoutUpgrade = this.lookaheadPlanner.predictFutureState(request, []);
      
      // Predict future state WITH upgrading
      const futureWithUpgrade = this.lookaheadPlanner.predictFutureState(request, [
        { type: 'upgrade' }
      ]);

      Logger.debug('Upgrade lookahead prediction', {
        withoutUpgrade: {
          expectedHP: futureWithoutUpgrade.expectedHP,
          expectedResources: futureWithoutUpgrade.expectedResources,
          minResources: futureWithoutUpgrade.minResources,
          expectedDamage: futureWithoutUpgrade.expectedDamage
        },
        withUpgrade: {
          expectedHP: futureWithUpgrade.expectedHP,
          expectedResources: futureWithUpgrade.expectedResources,
          minResources: futureWithUpgrade.minResources,
          expectedDamage: futureWithUpgrade.expectedDamage,
          expectedResourceGeneration: futureWithUpgrade.expectedResourceGeneration
        }
      });

      // Upgrade if:
      // 1. We'll still be safe (HP > 50) after upgrade
      // 2. We'll have enough resources for next 3 turns
      // 3. The upgrade provides benefit (more resource generation or better survival)
      const willBeSafe = futureWithUpgrade.expectedHP > 50;
      const willHaveResources = futureWithUpgrade.minResources >= 20; // Keep emergency buffer
      const providesBenefit = 
        futureWithUpgrade.expectedResourceGeneration > futureWithoutUpgrade.expectedResourceGeneration ||
        futureWithUpgrade.expectedHP > futureWithoutUpgrade.expectedHP ||
        futureWithUpgrade.expectedDamage < futureWithoutUpgrade.expectedDamage;

      if (willBeSafe && willHaveResources && providesBenefit) {
        Logger.debug('Upgrade approved by lookahead', {
          reason: 'Safe HP, sufficient resources, and provides benefit',
          resourceGenIncrease: futureWithUpgrade.expectedResourceGeneration - futureWithoutUpgrade.expectedResourceGeneration
        });
        return true;
      }

      Logger.debug('Upgrade rejected by lookahead', {
        willBeSafe,
        willHaveResources,
        providesBenefit
      });
      return false;
    }

    // Fallback to simple heuristic if lookahead not available
    return this.shouldUpgrade(playerTower, enemyTowers, turn);
  }

  /**
   * Simple upgrade heuristic (fallback when lookahead not available)
   */
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
    // Skip dead enemies (HP <= 0)
    let bestTarget: Tower | null = null;
    let bestScore = Infinity;
    
    enemyTowers.forEach(enemy => {
      // Skip dead enemies
      if (enemy.hp <= 0) {
        return;
      }
      
      const score = enemy.hp + enemy.armor;
      if (score < bestScore) {
        bestScore = score;
        bestTarget = enemy;
      }
    });
    
    return bestTarget;
  }

  /**
   * Find best attack target using resource estimates and Game Theory history
   */
  private findBestAttackTargetWithHistory(
    gameId: number,
    enemyTowers: Tower[],
    playerTower: Tower,
    resourceTracker: EnemyResourceTracker,
    gameTheory: GameTheoryNegotiation | null
  ): Tower | null {
    let bestTarget: Tower | null = null;
    let bestScore: number = Infinity;
    
    enemyTowers.forEach(enemy => {
      // Skip dead enemies (HP <= 0)
      if (enemy.hp <= 0) {
        return;
      }
      
      const estimate = resourceTracker.getEstimate(enemy.playerId);
      
      // Base score: HP + armor (lower is better)
      let score = enemy.hp + enemy.armor;
      
      // Game Theory history adjustments
      if (gameTheory) {
        // AVOID attacking allies (high penalty)
        if (gameTheory.isAlly(gameId, enemy.playerId)) {
          score += 200; // Very low priority (high score) - avoid attacking allies
          Logger.debug('Avoiding ally in combat', {
            playerId: enemy.playerId,
            allianceTurns: gameTheory.getAllianceRecord(gameId, enemy.playerId)?.allianceTurns || 0
          });
        }
        
        // PRIORITIZE enemies who betrayed us (high priority)
        if (gameTheory.hasBetrayed(gameId, enemy.playerId)) {
          score -= 100; // Very high priority (low score) - attack betrayers
          Logger.debug('Prioritizing betrayer in combat', {
            playerId: enemy.playerId
          });
        }
        
        // Use cooperation history to predict behavior
        const cooperationLevel = gameTheory.getCooperationLevel(gameId, enemy.playerId);
        const willAttackUs = gameTheory.willLikelyAttackUs(gameId, enemy.playerId);
        
        if (willAttackUs) {
          // Enemy likely to attack us - prioritize them (preemptive strike)
          score -= 40;
          Logger.debug('Enemy likely to attack us', {
            playerId: enemy.playerId,
            cooperationLevel,
            turnsSinceLastAttack: gameTheory.getGameHistory(gameId, enemy.playerId)?.turnsSinceLastAttack || Infinity
          });
        } else if (cooperationLevel > 0.7) {
          // High cooperation - lower priority (but not an ally)
          score += 30;
        }
      }
      
      // Adjust based on resource estimates
      if (estimate) {
        // Prioritize enemies who can upgrade (threat)
        if (resourceTracker.canAffordUpgradeForGame(gameId, enemy.playerId)) {
          score -= 50; // Higher priority (lower score)
        }
        
        // Prioritize enemies with high resources (can make big attacks)
        if (estimate.estimatedResources > estimate.resourceGeneration * 2) {
          score -= 30; // Higher priority
        }
        
        // Prioritize enemies with low resources (easier to finish)
        if (estimate.estimatedResources < estimate.resourceGeneration * 0.5) {
          score += 20; // Lower priority (higher score)
        }
      }
      
      if (score < bestScore) {
        bestScore = score;
        bestTarget = enemy;
      }
    });
    
    // If no target found, fall back to basic targeting
    if (bestTarget === null) {
      return this.findBestAttackTarget(enemyTowers, playerTower);
    }
    
    // If all enemies are allies, log warning but attack anyway
    const finalTarget: Tower = bestTarget;
    if (gameTheory && gameTheory.isAlly(gameId, finalTarget.playerId)) {
      Logger.warn('All enemies are allies, attacking anyway', {
        targetId: finalTarget.playerId
      });
    }
    
    return finalTarget;
  }

  /**
   * Calculate optimal attack size based on enemy resources, state, and history
   */
  private calculateOptimalAttackSize(
    gameId: number,
    target: Tower,
    availableResources: number,
    resourceTracker: EnemyResourceTracker,
    gameTheory: GameTheoryNegotiation | null
  ): number {
    const estimate = resourceTracker.getEstimateForGame(gameId, target.playerId);
    
    // Base attack: reasonable portion of resources
    let attackSize = Math.min(availableResources, 30);
    
    // Game Theory history adjustments
    if (gameTheory) {
      // If enemy betrayed us, attack harder (retaliation)
      if (gameTheory.hasBetrayed(gameId, target.playerId)) {
        attackSize = Math.min(availableResources, 45); // Larger attack
        Logger.debug('Attacking betrayer with increased force', {
          playerId: target.playerId,
          attackSize
        });
      }
      
      // If enemy is our ally, attack smaller (minimal damage if we must attack)
      if (gameTheory.isAlly(gameId, target.playerId)) {
        attackSize = Math.min(attackSize, 15); // Smaller attack
        Logger.debug('Attacking ally with reduced force', {
          playerId: target.playerId,
          attackSize,
          allianceTurns: gameTheory.getAllianceRecord(gameId, target.playerId)?.allianceTurns || 0
        });
      }
      
      // If enemy is likely to attack us, attack harder (preemptive)
      if (gameTheory.willLikelyAttackUs(gameId, target.playerId)) {
        attackSize = Math.min(availableResources, 40);
      }
    }
    
    if (estimate) {
      // If enemy can upgrade, attack harder to prevent upgrade
      if (resourceTracker.canAffordUpgradeForGame(gameId, target.playerId)) {
        attackSize = Math.min(availableResources, Math.max(attackSize, 40));
      }
      
      // If enemy has low resources, smaller attack might be enough
      if (estimate.estimatedResources < estimate.resourceGeneration * 0.5) {
        attackSize = Math.min(attackSize, 20);
      }
      
      // If enemy has high resources, attack harder
      if (estimate.estimatedResources > estimate.resourceGeneration * 2) {
        attackSize = Math.min(availableResources, Math.max(attackSize, 35));
      }
      
      // Adjust based on enemy HP (finish them off)
      if (target.hp < 30) {
        attackSize = Math.min(attackSize, target.hp + target.armor + 5);
      }
    }
    
    return Math.max(5, Math.min(attackSize, availableResources));
  }

  private getUpgradeCost(level: number): number {
    // Cost: 50 × (1.75 ^ (level - 1))
    return Math.floor(50 * Math.pow(1.75, level - 1));
  }

  /**
   * Filter out dead enemies (HP <= 0) from planning
   */
  private filterAliveEnemies(enemyTowers: Tower[]): Tower[] {
    return enemyTowers.filter(enemy => enemy.hp > 0);
  }

  private getActionCost(action: CombatResponseAction, playerLevel: number = 1): number {
    if (action.type === 'upgrade') {
      return this.getUpgradeCost(playerLevel);
    } else if (action.type === 'armor') {
      return action.amount || 0;
    } else if (action.type === 'attack') {
      return action.troopCount || 0;
    }
    return 0;
  }

  /**
   * Generate possible action combinations for lookahead planning
   */
  private generateActionCombinations(request: CombatRequest): CombatResponseAction[][] {
    const { playerTower, enemyTowers } = request;
    const resources = playerTower.resources || 0;
    const combinations: CombatResponseAction[][] = [];

    // Generate possible actions
    const possibleActions: CombatResponseAction[] = [];

    // Upgrade action
    const upgradeCost = this.getUpgradeCost(playerTower.level);
    if (resources >= upgradeCost && this.shouldUpgrade(playerTower, enemyTowers, request.turn)) {
      possibleActions.push({ type: 'upgrade' });
    }

    // Armor actions (different amounts)
    if (this.shouldBuildArmor(playerTower, request.turn)) {
      for (let amount = 5; amount <= Math.min(10, resources); amount += 5) {
        possibleActions.push({ type: 'armor', amount });
      }
    }

    // Attack actions (different targets and amounts)
    // Skip dead enemies (HP <= 0)
    for (const enemy of enemyTowers) {
      // Skip dead enemies
      if (enemy.hp <= 0) {
        continue;
      }
      
      for (let troops = 10; troops <= Math.min(30, resources); troops += 10) {
        possibleActions.push({
          type: 'attack',
          targetId: enemy.playerId,
          troopCount: troops
        });
      }
    }

    // Generate single-action combinations
    for (const action of possibleActions) {
      const cost = this.getActionCost(action, playerTower.level);
      if (cost <= resources) {
        combinations.push([action]);

        // Try to add second action if resources allow
        const remaining = resources - cost;
        for (const secondAction of possibleActions) {
          if (action === secondAction) continue;
          const secondCost = this.getActionCost(secondAction, playerTower.level);
          if (secondCost <= remaining && this.isValidCombination([action, secondAction])) {
            combinations.push([action, secondAction]);
          }
        }
      }
    }

    // If no combinations, return empty action
    if (combinations.length === 0) {
      combinations.push([]);
    }

    return combinations;
  }

  /**
   * Check if action combination is valid
   */
  private isValidCombination(actions: CombatResponseAction[]): boolean {
    let upgradeCount = 0;
    let armorCount = 0;
    const attackTargets = new Set<number>();

    for (const action of actions) {
      if (action.type === 'upgrade') upgradeCount++;
      if (action.type === 'armor') armorCount++;
      if (action.type === 'attack') {
        if (attackTargets.has(action.targetId!)) {
          return false; // Can't attack same target twice
        }
        attackTargets.add(action.targetId!);
      }
    }

    return upgradeCount <= 1 && armorCount <= 1;
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
