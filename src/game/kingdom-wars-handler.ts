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
    
    // Initialize MCTS with performance-optimized settings for 100-150 req/s
    // Reduced iterations and time limit to ensure < 1s response time
    const iterations = 200; // Reduced from 500 for faster responses
    const timeLimit = 400; // Reduced from 800ms to ensure < 1s total response time
    this.mcts = new MCTSKingdomWars(iterations, 1.41, timeLimit);
    Logger.log('MCTS enabled for combat phase (performance optimized)', { iterations, timeLimit });

    // Game Theory will be initialized with player ID from first request
    Logger.log('Game Theory enabled for negotiation phase');

    // Initialize resource tracker
    this.resourceTracker = new EnemyResourceTracker();
    Logger.log('Enemy Resource Tracker enabled');

    // Initialize lookahead planner with performance-optimized settings
    // Reduced depth for faster responses while maintaining strategic value
    const maxTurns = 3; // Reduced from 5 to 3 for better performance (100-150 req/s)
    this.lookaheadPlanner = new MultiTurnPlanner(maxTurns, this.resourceTracker);
    Logger.log('Multi-turn lookahead enabled (performance optimized)', { maxTurns });
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

      // Check if game is over (bot is dead or no enemies left)
      const isBotDead = request.playerTower.hp <= 0;
      const aliveEnemies = this.filterAliveEnemies(request.enemyTowers);
      const isGameOver = isBotDead || aliveEnemies.length === 0;
      
      if (isGameOver) {
        Logger.info('Game is over - cleaning up cache', {
          gameId: request.gameId,
          turn: request.turn,
          isBotDead,
          aliveEnemies: aliveEnemies.length,
          botHP: request.playerTower.hp
        });
        
        // Clean up game-specific caches
        this.resourceTracker.clearGame(request.gameId);
        if (this.gameTheory) {
          this.gameTheory.clearGame(request.gameId);
        }
        
        // Return empty response (game is over)
        res.status(200).json([]);
        return;
      }
      
      // Removed debug logging for performance (100-150 req/s)
      // if (aliveEnemies.length !== request.enemyTowers.length) { ... }

      // Update resource tracking (only for alive enemies)
      this.resourceTracker.updateEstimates(
        request.gameId,
        request.turn,
        aliveEnemies,
        request.combatActions,
        []
      );

      // Log resource estimates (only at debug level to reduce I/O for performance)
      // Removed for performance - too expensive for 100-150 req/s
      // const resourceEstimates = this.resourceTracker.getAllEstimatesForGame(request.gameId);

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
      
      // Performance check: Warn if response time exceeds threshold
      if (processingTime > 500) {
        Logger.warn('Slow negotiation response', {
          gameId: request.gameId,
          turn: request.turn,
          timeMs: processingTime,
          warning: 'Response time > 500ms, may impact 100-150 req/s target'
        });
      }
      
      // Log decision details (only essential info for performance)
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
      const MAX_RESPONSE_TIME = 1000; // 1 second max response time
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

      // Check if game is over (bot is dead or no enemies left)
      const isBotDead = request.playerTower.hp <= 0;
      const aliveEnemies = this.filterAliveEnemies(request.enemyTowers);
      const isGameOver = isBotDead || aliveEnemies.length === 0;
      
      if (isGameOver) {
        Logger.info('Game is over - cleaning up cache', {
          gameId: request.gameId,
          turn: request.turn,
          isBotDead,
          aliveEnemies: aliveEnemies.length,
          botHP: request.playerTower.hp
        });
        
        // Clean up game-specific caches
        this.resourceTracker.clearGame(request.gameId);
        if (this.gameTheory) {
          this.gameTheory.clearGame(request.gameId);
        }
        
        // Return empty response (game is over)
        res.status(200).json([]);
        return;
      }
      
      // Removed debug logging for performance (100-150 req/s)
      // if (aliveEnemies.length !== request.enemyTowers.length) { ... }

      // Update resource tracking (only for alive enemies)
      this.resourceTracker.updateEstimates(
        request.gameId,
        request.turn,
        aliveEnemies,
        [],
        request.previousAttacks
      );

      // Use resource estimates for planning (logging removed for performance)
      // const resourceEstimates = this.resourceTracker.getAllEstimatesForGame(request.gameId);

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
        // Removed verbose logging for performance (100-150 req/s)
        // Logger.log('Using MCTS for combat decision', { ... });
        
        // Pass Game Theory and Resource Tracker to MCTS for better decisions
        this.mcts.setHelpers(this.gameTheory, this.resourceTracker);
        
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
        // Removed verbose logging for performance (100-150 req/s)
        // Logger.log('Using multi-turn lookahead for combat decision', { ... });
        
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
    // Removed debug logging for performance (100-150 req/s)
    
    // Find best ally (strongest non-threat)
    const bestAlly = this.findBestAlly(enemyTowers, threats);
    // Removed debug logging for performance
    
    // Find best target (weakest threat)
    const bestTarget = this.findBestTarget(enemyTowers, threats);
    // Removed debug logging for performance
    
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
    
    // Use multi-turn lookahead to predict incoming damage and plan
    const futureState = this.lookaheadPlanner.predictFutureState(request, []);
    const predictedDamage = futureState.expectedDamage;
    const predictedHP = futureState.expectedHP;
    
    // PRIORITY ORDER: Survival > Leveling > Defense > Attack (only if necessary)
    // MAIN FOCUS: Leveling and Defense - Attack only when absolutely necessary
    
    // PRIORITY 1: CRITICAL SURVIVAL - Build armor if HP is critical (< 40)
    // This is immediate survival - must be FIRST priority
    const isCriticalHP = playerTower.hp < 40;
    let criticalArmorBuilt = false;
    
    if (isCriticalHP && remainingResources > 0) {
      const criticalArmorNeeded = Math.max(0, 20 - (playerTower.armor || 0)); // FIXED: Build up to 20 armor (was 15)
      if (criticalArmorNeeded > 0) {
        const armorAmount = Math.min(criticalArmorNeeded, remainingResources, 15); // FIXED: Max 15 per turn (was 10)
        if (armorAmount > 0) {
          actions.push({ type: 'armor', amount: armorAmount });
          remainingResources -= armorAmount;
          criticalArmorBuilt = true;
          Logger.debug('CRITICAL SURVIVAL: Armor built for immediate survival', { 
            hp: playerTower.hp,
            armorAmount, 
            remaining: remainingResources
          });
        }
      }
    }
    
    // PRIORITY 2: LEVELING (Upgrade) - MAIN FOCUS: Increase income/resources
    // Upgrade BEFORE building more armor because it increases income for future defense
    // This is a MAIN FOCUS - prioritize upgrades to increase resource generation
    const upgradeCost = this.getUpgradeCost(playerTower.level);
    const shouldUpgrade = this.shouldUpgradeWithLookahead(request, remainingResources, upgradeCost);
    // Removed debug logging for performance (100-150 req/s)
    
    // FIXED: More aggressive upgrade - lower HP thresholds and upgrade when behind
    // Only skip upgrade if HP is critical (already handled above)
    const minSafeHPForUpgrade = turn <= 5 ? 50 : turn <= 10 ? 45 : 40; // Lowered from 60/55/50
    const isSafeForUpgrade = (futureState.expectedHP > minSafeHPForUpgrade || 
                            (turn <= 10 && playerTower.hp > 45)) && !isCriticalHP;
    
    // CRITICAL FIX: Upgrade when behind in levels (even if HP is lower)
    // FIXED: Lower HP thresholds for "behind" upgrades (40/35 → 35/30)
    const avgEnemyLevel = enemyTowers.length > 0 
      ? enemyTowers.reduce((sum, e) => sum + e.level, 0) / enemyTowers.length 
      : playerTower.level;
    const isBehind = playerTower.level < avgEnemyLevel - 0.5;
    const isVeryBehind = playerTower.level < avgEnemyLevel - 1;
    
    // Upgrade if: (safe AND shouldUpgrade) OR (behind AND HP > 35) OR (very behind AND HP > 30)
    const shouldUpgradeNow = (isSafeForUpgrade && shouldUpgrade) || 
                            (isBehind && playerTower.hp > 35) || 
                            (isVeryBehind && playerTower.hp > 30);
    
    if (remainingResources >= upgradeCost && shouldUpgradeNow) {
      actions.push({ type: 'upgrade' });
      remainingResources -= upgradeCost;
      Logger.debug('LEVELING: Upgrade action added (increases income for defense)', { 
        cost: upgradeCost, 
        remaining: remainingResources,
        turn,
        currentHP: playerTower.hp,
        currentLevel: playerTower.level,
        avgEnemyLevel: avgEnemyLevel.toFixed(2),
        isBehind,
        isVeryBehind,
        expectedHP: futureState.expectedHP,
        upgradeReason: isVeryBehind ? 'Very behind in levels' : isBehind ? 'Behind in levels' : 'Safe to upgrade',
        incomeIncrease: 'Upgrade increases resource generation for future defense'
      });
    } else if (remainingResources >= upgradeCost && !shouldUpgradeNow) {
      Logger.debug('LEVELING: Skipping upgrade (not safe or not behind)', {
        turn,
        currentHP: playerTower.hp,
        currentLevel: playerTower.level,
        avgEnemyLevel: avgEnemyLevel.toFixed(2),
        isBehind,
        isVeryBehind,
        minSafeHPForUpgrade,
        expectedHP: futureState.expectedHP,
        reason: 'HP too low or not behind in levels'
      });
    }
    
    // PRIORITY 3: DEFENSE - MAIN FOCUS: Build armor with remaining resources (after leveling)
    // Now that we've upgraded (if safe), build armor with increased income potential
    // This is a MAIN FOCUS - prioritize defense to survive and reduce incoming damage
    // Note: We evaluate defense even if critical armor was built, to build more if needed
    // FIXED: More proactive defense - build if HP < 60 (proactive, not reactive)
    // EARLY ROUNDS: Build armor if HP < 60 or late game - prioritize survival
    const isEarlyRoundsForDefense = turn <= 10;
    const shouldBuildDefenseInEarlyRounds = isEarlyRoundsForDefense && (playerTower.hp < 60 || turn >= 25);
    
    const shouldArmor = this.shouldBuildArmorWithLookahead(
      playerTower, 
      turn, 
      predictedDamage,
      predictedHP,
      enemyTowers
    );
    
    // Removed debug logging for performance (100-150 req/s)
    
    // Build armor with remaining resources (after upgrade)
    // MAIN FOCUS: Defense - Save resources for future upgrades, but prioritize defense
    const upgradeCostForDefense = this.getUpgradeCost(playerTower.level);
    const resourcesNeededForUpgradeDefense = Math.max(0, upgradeCostForDefense - remainingResources);
    const closeToUpgradeDefense = resourcesNeededForUpgradeDefense <= 40;
    const veryCloseToUpgradeDefense = resourcesNeededForUpgradeDefense <= 20;
    const defenseResourceBuffer = veryCloseToUpgradeDefense 
      ? Math.max(5, upgradeCostForDefense - remainingResources) // Very close: minimal buffer (5) to allow upgrade
      : closeToUpgradeDefense 
        ? Math.max(10, upgradeCostForDefense - remainingResources + 5) // Close: save more
        : 10; // Not close: save base buffer (10 resources) - defense is priority
    
    const availableForDefense = Math.max(0, remainingResources - defenseResourceBuffer);
    
    // FIXED: More proactive defense - build armor when HP < 60 (not just < 50)
    // EARLY ROUNDS: Build if HP < 60 or late game - save resources for upgrades but prioritize survival
    if (shouldArmor.shouldBuild && remainingResources > 0) {
      // In early rounds, build if HP < 60 (proactive) or late game
      if (isEarlyRoundsForDefense && !shouldBuildDefenseInEarlyRounds && !criticalArmorBuilt) {
        Logger.debug('EARLY ROUNDS: Skipping defense to save resources for upgrades', {
          turn,
          hp: playerTower.hp,
          resources: remainingResources,
          defenseResourceBuffer,
          availableForDefense,
          reason: 'Saving resources for leveling and future defense'
        });
      } else if (availableForDefense > 0) {
        // FIXED: Build more armor proactively (15 instead of 10 max)
        const armorAmount = Math.min(
          shouldArmor.recommendedAmount, 
          availableForDefense, 
          15 // Max 15 per turn (increased from 10)
        );
        
        if (armorAmount > 0) {
          actions.push({ type: 'armor', amount: armorAmount });
          remainingResources -= armorAmount;
          Logger.debug('DEFENSE: Armor action added (after leveling, with resource saving)', { 
            amount: armorAmount, 
            remaining: remainingResources,
            defenseResourceBuffer,
            availableForDefense,
            reason: shouldArmor.reason,
            criticalArmorAlreadyBuilt: criticalArmorBuilt,
            earlyRounds: isEarlyRoundsForDefense
          });
        }
      } else {
        Logger.debug('DEFENSE: Skipping to save resources for upgrade', {
          turn,
          resources: remainingResources,
          defenseResourceBuffer,
          availableForDefense,
          reason: 'Saving resources for upcoming upgrade'
        });
      }
    }
    
    // PRIORITY 4: ATTACK - LAST PRIORITY: Only attack when absolutely necessary
    // MAIN FOCUS: Leveling and Defense - Attack only if:
    // 1. Can kill enemy (eliminate threat = high value)
    // 2. Critical survival (HP < 40, must reduce incoming damage)
    // 3. 2-player scenario (must finish the game)
    // Otherwise: Save ALL resources for leveling and defense
    
    const upgradeCostForNext = this.getUpgradeCost(playerTower.level);
    const resourcesNeededForUpgrade = Math.max(0, upgradeCostForNext - remainingResources);
    
    // FIXED: Dynamic resource buffer - save 70-80% for upgrades in early game
    // - Early game (turns 1-10): Save 70-80% of resources for upgrades (base buffer: 5-10)
    // - Mid game (turns 11-20): Save 50-60% (base buffer: 10-15)
    // - Late game (turns 21+): Save 40-50% (base buffer: 15)
    // - If close to upgrade (< 40 resources away): Save more (upgrade cost - current resources + 5)
    // - If very close (< 20 resources away): Save minimal (5 resources) to allow upgrade next turn
    const isEarlyGame = turn <= 10;
    const isMidGame = turn > 10 && turn <= 20;
    const baseBuffer = isEarlyGame 
      ? 5  // Early game: Save 70-80% for upgrades (minimal buffer)
      : isMidGame 
        ? 10 // Mid game: Save 50-60% (moderate buffer)
        : 15; // Late game: Save 40-50% (higher buffer)
    
    const closeToUpgrade = resourcesNeededForUpgrade <= 40;
    const veryCloseToUpgrade = resourcesNeededForUpgrade <= 20;
    const resourceBuffer = veryCloseToUpgrade 
      ? Math.max(5, upgradeCostForNext - remainingResources) // Very close: minimal buffer (5) to allow upgrade
      : closeToUpgrade 
        ? Math.max(baseBuffer, upgradeCostForNext - remainingResources + 5) // Close: save more
        : baseBuffer; // Not close: save base buffer (5-15 depending on game phase)
    
    const availableForAttack = Math.max(0, remainingResources - resourceBuffer);
    
    // Check if only 2 players remain (game might end soon)
    const aliveEnemies = enemyTowers.filter(e => e.hp > 0).length;
    const isTwoPlayerScenario = aliveEnemies === 1; // Only 1 enemy = 2 players total
    
    // Only consider attacking if we have resources AND it's necessary
    if (remainingResources > 0 && availableForAttack > 0) {
      const target = this.findBestAttackTargetWithHistory(
        request.gameId,
        enemyTowers, 
        playerTower,
        this.resourceTracker,
        this.gameTheory,
        request.turn
      );
      // Removed verbose debug logging for performance (100-150 req/s)
      // Only log critical attack decisions
      
      if (target) {
        // Calculate if we can kill the target
        const exactKillDamage = target.hp + target.armor;
        const canKillTarget = exactKillDamage <= availableForAttack;
        const isCriticalHP = playerTower.hp < 40; // Critical survival threshold
        const isTwoPlayer = isTwoPlayerScenario; // Must finish the game
        
        // ATTACK ONLY WHEN ABSOLUTELY NECESSARY:
        // 1. Can kill target (eliminate enemy = high value, reduces future threats)
        // 2. Critical survival (HP < 40, must reduce incoming damage to survive)
        // 3. 2-player scenario (must finish the game, no other options)
        const shouldAttack = canKillTarget || isCriticalHP || isTwoPlayer;
        
        if (!shouldAttack) {
          // Removed debug logging for performance (100-150 req/s)
        } else {
          // Use resource estimates and history to determine optimal attack size
          // Limit to available resources (after saving buffer for leveling/defense)
          const attackAmount = this.calculateOptimalAttackSize(
            request.gameId,
            target,
            availableForAttack,
            this.resourceTracker,
            this.gameTheory,
            request.turn
          );
          
          if (attackAmount > 0) {
            actions.push({
              type: 'attack',
              targetId: target.playerId,
              troopCount: attackAmount
            });
            remainingResources -= attackAmount;
            // Removed verbose debug logging for performance (100-150 req/s)
          }
        }
      }
      } else {
        // Removed debug logging for performance (100-150 req/s)
      }
    
    const resourceUsage = {
      start: startResources,
      remaining: remainingResources,
      spent: startResources - remainingResources
    };
    
    // Removed debug logging for performance (100-150 req/s)
    
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
    
    // Basic safety check: must have enough resources
    if (availableResources < upgradeCost) {
      return false;
    }
    
    // FIXED: Lower HP thresholds for early game upgrades (50/45/40 instead of 60/55/50)
    const hp = playerTower.hp;
    const minHP = turn <= 5 ? 50 : turn <= 10 ? 45 : 40; // More aggressive early game
    if (hp <= minHP) {
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

      // Calculate resource generation increase value
      const initialLevel = playerTower.level;
      const finalLevelWithUpgrade = futureWithUpgrade.finalLevel;
      const finalLevelWithoutUpgrade = futureWithoutUpgrade.finalLevel;
      const levelIncrease = finalLevelWithUpgrade - finalLevelWithoutUpgrade;
      
      // Calculate per-turn resource generation increase
      const genWithoutUpgrade = futureWithoutUpgrade.resourceGenerationPerTurn[0] || 0;
      const genWithUpgrade = futureWithUpgrade.resourceGenerationPerTurn[0] || 0;
      const genIncreasePerTurnCalc = genWithUpgrade - genWithoutUpgrade;
      
      // Total resource generation increase over lookahead period
      const totalGenIncrease = futureWithUpgrade.expectedResourceGeneration - futureWithoutUpgrade.expectedResourceGeneration;
      
      Logger.debug('Upgrade lookahead prediction with income calculation', {
        currentLevel: initialLevel,
        levelAfterUpgrade: finalLevelWithUpgrade,
        levelWithoutUpgrade: finalLevelWithoutUpgrade,
        levelIncrease,
        resourceGenPerTurn: {
          withoutUpgrade: genWithoutUpgrade,
          withUpgrade: genWithUpgrade,
          increase: genIncreasePerTurnCalc
        },
        totalResourceGenIncrease: totalGenIncrease,
        resourceGenPerTurnBreakdown: {
          withoutUpgrade: futureWithoutUpgrade.resourceGenerationPerTurn,
          withUpgrade: futureWithUpgrade.resourceGenerationPerTurn
        },
        withoutUpgrade: {
          expectedHP: futureWithoutUpgrade.expectedHP,
          expectedResources: futureWithoutUpgrade.expectedResources,
          minResources: futureWithoutUpgrade.minResources,
          expectedDamage: futureWithoutUpgrade.expectedDamage,
          expectedResourceGeneration: futureWithoutUpgrade.expectedResourceGeneration
        },
        withUpgrade: {
          expectedHP: futureWithUpgrade.expectedHP,
          expectedResources: futureWithUpgrade.expectedResources,
          minResources: futureWithUpgrade.minResources,
          expectedDamage: futureWithUpgrade.expectedDamage,
          expectedResourceGeneration: futureWithUpgrade.expectedResourceGeneration
        }
      });

      // FIXED: Lower HP thresholds for early game upgrades (50/45/40 instead of 60/55/50)
      // 1. We'll still be safe (HP threshold based on turn)
      const minSafeHP = turn <= 5 ? 50 : turn <= 10 ? 45 : 40;
      const willBeSafe = futureWithUpgrade.expectedHP > minSafeHP;
      
      // 2. We'll have enough resources for next 5 turns (lower threshold early game)
      const minResources = turn <= 10 ? 10 : 15; // More aggressive early game (reduced from 15/20)
      const willHaveResources = futureWithUpgrade.minResources >= minResources;
      
      // 3. The upgrade provides benefit (more resource generation or better survival)
      // Calculate resource generation increase value (already calculated above)
      const resourceGenIncrease = totalGenIncrease; // Total additional resources generated over lookahead
      const hpImprovement = futureWithUpgrade.expectedHP - futureWithoutUpgrade.expectedHP;
      const damageReduction = futureWithoutUpgrade.expectedDamage - futureWithUpgrade.expectedDamage;
      
      // Calculate upgrade value: resource generation increase over lookahead period
      const upgradeValue = resourceGenIncrease; // Total additional resources generated over lookahead
      const netValue = upgradeValue - upgradeCost; // Net value (may be negative initially, but pays off long-term)
      
      const providesBenefit = 
        resourceGenIncrease > 0 || // Resource generation increase
        hpImprovement > 0 || // HP improvement
        damageReduction > 0; // Damage reduction
      
      // Early game: Upgrade if safe and provides ANY benefit OR positive net value
      // Late game: Upgrade only if significant benefit
      const isEarlyGame = turn <= 10;
      const significantBenefit = resourceGenIncrease >= 10 || hpImprovement >= 5 || damageReduction >= 5;
      const hasPositiveValue = netValue > 0 || resourceGenIncrease >= upgradeCost * 0.5; // At least 50% ROI
      
      if (willBeSafe && willHaveResources && (isEarlyGame ? (providesBenefit || hasPositiveValue) : significantBenefit)) {
        Logger.debug('Upgrade approved by lookahead', {
          reason: isEarlyGame ? 'Early game: safe HP and provides benefit/positive value' : 'Late game: safe HP and significant benefit',
          upgradeCost,
          upgradeValue: resourceGenIncrease,
          genIncreasePerTurn: genIncreasePerTurnCalc,
          netValue,
          hpImprovement,
          damageReduction,
          roi: upgradeCost > 0 ? ((resourceGenIncrease / upgradeCost) * 100).toFixed(1) + '%' : 'N/A'
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
   * IMPROVED: More aggressive upgrade strategy
   */
  private shouldUpgrade(
    playerTower: Tower,
    enemyTowers: Tower[],
    turn: number
  ): boolean {
    const hp = playerTower.hp;
    const level = playerTower.level;
    const avgEnemyLevel = enemyTowers.reduce((sum, e) => sum + e.level, 0) / enemyTowers.length;
    const isBehind = level < avgEnemyLevel;
    const isVeryBehind = level < avgEnemyLevel - 0.5; // More than 0.5 levels behind
    
    // FIXED: Lower HP thresholds for upgrades (60/55/50 → 50/45/40)
    // CRITICAL: Very early game (turns 0-5) - upgrade ASAP if safe
    if (turn <= 5 && hp > 50) {
      return true; // Aggressive early upgrade
    }
    
    // HIGH PRIORITY: Early game (turns 6-10) - upgrade if safe
    if (turn <= 10 && hp > 45) {
      return true; // Upgrade early for resource generation advantage
    }
    
    // MEDIUM PRIORITY: Mid game (turns 11-20) - upgrade if safe or behind
    if (turn <= 20 && hp > 40) {
      return isBehind || hp > 50; // Upgrade if behind or very safe
    }
    
    // LATE GAME: Only upgrade if very behind (resource generation critical)
    if (turn > 20) {
      return isVeryBehind && hp > 40; // Only if significantly behind
    }
    
    return false;
  }

  private shouldBuildArmor(playerTower: Tower, turn: number): boolean {
    // FIXED: More proactive defense - build armor when HP < 60 (not just < 40)
    // Build armor if:
    // 1. HP is low (< 60) - PROACTIVE (was < 40)
    // 2. Late game (turn >= 25, fatigue damage)
    // 3. Armor is low (< 10)
    // 4. Mid game (turn >= 20) - prepare for late game
    
    const isLowHP = playerTower.hp < 60; // PROACTIVE: Build when HP < 60
    const isLateGame = turn >= 25;
    const isMidGame = turn >= 20; // Prepare for late game
    const isLowArmor = playerTower.armor < 10;
    
    return (isLowHP || isLateGame || isMidGame) && isLowArmor;
  }

  /**
   * Enhanced armor decision with multi-turn lookahead for survival planning
   * Main goal: Stay alive - prioritize defense over everything else
   * IMPROVED: More proactive defense strategy
   */
  private shouldBuildArmorWithLookahead(
    playerTower: Tower,
    turn: number,
    predictedDamage: number,
    predictedHP: number,
    enemyTowers: Tower[]
  ): { shouldBuild: boolean; recommendedAmount: number; reason: string } {
    const hp = playerTower.hp;
    const armor = playerTower.armor || 0;
    const resources = playerTower.resources || 0;
    
    // CRITICAL: If HP is very low (< 30), prioritize armor heavily - BUILD MAX
    if (hp < 30) {
      const neededArmor = Math.max(0, 20 - armor); // Try to get to 20 armor
      return {
        shouldBuild: true,
        recommendedAmount: Math.min(neededArmor, resources, 10), // Build max (10) if possible
        reason: `CRITICAL: HP < 30, need maximum armor for survival`
      };
    }
    
    // HIGH PRIORITY: If HP is low (< 50), build armor proactively - BUILD MAX
    if (hp < 50) {
      const neededArmor = Math.max(0, 15 - armor);
      return {
        shouldBuild: true,
        recommendedAmount: Math.min(neededArmor, resources, 10), // Build max (10) if possible
        reason: `HIGH: HP < 50, build maximum armor proactively`
      };
    }
    
    // MEDIUM-HIGH PRIORITY: If HP is moderate (< 60) and predicted damage is high - BUILD MAX
    if (hp < 60 && predictedDamage > 10) {
      const neededArmor = Math.max(0, 15 - armor);
      return {
        shouldBuild: true,
        recommendedAmount: Math.min(neededArmor, resources, 10), // Build max (10) if possible
        reason: `HP < 60 and predicted damage ${predictedDamage} > 10, build armor proactively`
      };
    }
    
    // MEDIUM PRIORITY: If HP is moderate (< 60) - build armor proactively
    if (hp < 60 && armor < 10) {
      const neededArmor = Math.max(0, 10 - armor);
      return {
        shouldBuild: true,
        recommendedAmount: Math.min(neededArmor, resources, 10),
        reason: `HP < 60, build armor proactively (not reactive)`
      };
    }
    
    // HIGH PRIORITY: If predicted HP will be low (< 50) after damage
    if (predictedHP < 50 && armor < 15) {
      const neededArmor = Math.max(0, 15 - armor);
      return {
        shouldBuild: true,
        recommendedAmount: Math.min(neededArmor, resources, 10),
        reason: `Predicted HP ${predictedHP.toFixed(1)} < 50, need armor buffer`
      };
    }
    
    // LATE GAME: Fatigue damage (turn 25+) - BUILD MAX ARMOR
    if (turn >= 25) {
      const targetArmor = 15; // Higher target for late game
      if (armor < targetArmor) {
        const neededArmor = Math.max(0, targetArmor - armor);
        return {
          shouldBuild: true,
          recommendedAmount: Math.min(neededArmor, resources, 10), // Build max each turn
          reason: `Late game (turn ${turn}), fatigue damage requires maximum armor`
        };
      }
    }
    
    // PREPARE FOR LATE GAME: Turn 20-24, build armor buffer
    if (turn >= 20 && turn < 25 && armor < 10) {
      const neededArmor = Math.max(0, 10 - armor);
      return {
        shouldBuild: true,
        recommendedAmount: Math.min(neededArmor, resources, 10),
        reason: `Preparing for late game (turn ${turn}), build armor buffer`
      };
    }
    
    // MEDIUM PRIORITY: If we have low armor and enemies are strong
    const avgEnemyHP = enemyTowers.reduce((sum, e) => sum + e.hp, 0) / enemyTowers.length;
    if (armor < 10 && avgEnemyHP > 50 && hp < 80) {
      return {
        shouldBuild: true,
        recommendedAmount: Math.min(10 - armor, resources, 10),
        reason: `Low armor (${armor}) with strong enemies (avg HP ${avgEnemyHP.toFixed(1)})`
      };
    }
    
    // LOW PRIORITY: General armor maintenance (armor < 5)
    if (armor < 5 && resources >= 5 && hp > 60) {
      return {
        shouldBuild: true,
        recommendedAmount: Math.min(5 - armor, resources, 5),
        reason: `Maintenance: armor ${armor} < 5, build minimal armor`
      };
    }
    
    return {
      shouldBuild: false,
      recommendedAmount: 0,
      reason: `No armor needed: HP ${hp}, armor ${armor}, predicted HP ${predictedHP.toFixed(1)}`
    };
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
    gameTheory: GameTheoryNegotiation | null,
    turn: number
  ): Tower | null {
    let bestTarget: Tower | null = null;
    let bestScore: number = Infinity;
    
    enemyTowers.forEach(enemy => {
      // Skip dead enemies (HP <= 0)
      if (enemy.hp <= 0) {
        return;
      }
      
      // CRITICAL FIX: Completely exclude allies from attack targets
      if (gameTheory && gameTheory.isAlly(gameId, enemy.playerId, turn)) {
        Logger.debug('Skipping ally in combat (completely excluded)', {
          playerId: enemy.playerId,
          allianceTurns: gameTheory.getAllianceRecord(gameId, enemy.playerId)?.allianceTurns || 0,
          turn
        });
        return; // Skip this enemy - do not attack allies
      }
      
      const estimate = resourceTracker.getEstimate(enemy.playerId);
      
      // Base score: HP + armor (lower is better)
      let score = enemy.hp + enemy.armor;
      
      // Game Theory history adjustments
      if (gameTheory) {
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
    
    // If no target found (all enemies are allies or dead), return null
    if (bestTarget === null) {
      Logger.debug('No valid attack target found (all enemies are allies or dead)', {
        gameId,
        turn,
        enemyCount: enemyTowers.length
      });
      return null;
    }
    
    return bestTarget;
  }

  /**
   * Calculate optimal attack size based on enemy resources, state, and history
   * Uses resource estimates from history to plan efficient attacks
   * Avoids overkill when killing enemies
   */
  private calculateOptimalAttackSize(
    gameId: number,
    target: Tower,
    availableResources: number,
    resourceTracker: EnemyResourceTracker,
    gameTheory: GameTheoryNegotiation | null,
    turn: number
  ): number {
    const estimate = resourceTracker.getEstimateForGame(gameId, target.playerId);
    
    // Calculate exact damage needed to kill (HP + armor)
    const exactKillDamage = target.hp + target.armor;
    
    // Base attack: reasonable portion of resources, but consider kill damage
    let attackSize = Math.min(availableResources, 30);
    
    // PRIORITY 1: If we can kill them, use exact damage (avoid overkill)
    if (exactKillDamage <= availableResources && exactKillDamage > 0) {
      // Use exact kill damage, but add small buffer (1-2) for safety
      attackSize = Math.min(exactKillDamage + 2, availableResources);
      Logger.debug('Calculated exact kill damage', {
        playerId: target.playerId,
        exactKillDamage,
        targetHP: target.hp,
        targetArmor: target.armor,
        attackSize,
        reason: 'Exact kill damage to avoid overkill'
      });
    }
    
    // PRIORITY 2: Use resource estimates from history to plan efficient attacks
    if (estimate) {
      // Calculate enemy's current resource balance from history
      // estimatedResources already accounts for generation and spending
      const enemyResourceBalance = estimate.estimatedResources;
      const enemyResourceGeneration = estimate.resourceGeneration;
      
      Logger.debug('Enemy resource balance from history', {
        playerId: target.playerId,
        estimatedResources: enemyResourceBalance,
        resourceGeneration: enemyResourceGeneration,
        spendingPattern: {
          avgAttackSize: estimate.spendingPattern.avgAttackSize,
          totalSpent: estimate.spendingPattern.totalSpent,
          totalEarned: estimate.spendingPattern.totalEarned
        }
      });
      
      // If enemy has low resources, they can't defend well - smaller attack might be enough
      if (enemyResourceBalance < enemyResourceGeneration * 0.5) {
        // Enemy is resource-poor, but still need enough to kill if possible
        if (exactKillDamage <= availableResources) {
          attackSize = Math.min(attackSize, exactKillDamage + 1); // Minimal overkill
        } else {
          attackSize = Math.min(attackSize, 20); // Conservative attack
        }
        Logger.debug('Enemy has low resources, using efficient attack', {
          playerId: target.playerId,
          enemyResourceBalance,
          attackSize
        });
      }
      
      // If enemy has high resources, they can build armor/upgrade - attack harder
      if (enemyResourceBalance > enemyResourceGeneration * 2) {
        // Enemy is resource-rich, but still don't overkill
        if (exactKillDamage <= availableResources) {
          attackSize = Math.min(attackSize, exactKillDamage + 3); // Small buffer for potential armor
        } else {
          attackSize = Math.min(availableResources, Math.max(attackSize, 35));
        }
        Logger.debug('Enemy has high resources, using stronger attack', {
          playerId: target.playerId,
          enemyResourceBalance,
          attackSize
        });
      }
      
      // If enemy can upgrade, attack harder to prevent upgrade (but still avoid overkill)
      if (resourceTracker.canAffordUpgradeForGame(gameId, target.playerId)) {
        if (exactKillDamage <= availableResources) {
          // Can kill them, but add buffer for potential upgrade
          attackSize = Math.min(attackSize, exactKillDamage + 5);
        } else {
          attackSize = Math.min(availableResources, Math.max(attackSize, 40));
        }
        Logger.debug('Enemy can upgrade, preventing upgrade with attack', {
          playerId: target.playerId,
          attackSize
        });
      }
      
      // If enemy is close to death, use exact kill damage
      if (target.hp < 30 && exactKillDamage <= availableResources) {
        attackSize = Math.min(attackSize, exactKillDamage + 1); // Minimal overkill
        Logger.debug('Enemy close to death, using exact kill damage', {
          playerId: target.playerId,
          exactKillDamage,
          attackSize
        });
      }
    }
    
    // Game Theory history adjustments (but still respect kill damage)
    if (gameTheory) {
      // If enemy betrayed us, attack harder (retaliation) but don't overkill
      if (gameTheory.hasBetrayed(gameId, target.playerId)) {
        if (exactKillDamage <= availableResources) {
          attackSize = Math.min(attackSize, exactKillDamage + 3); // Small buffer for betrayer
        } else {
          attackSize = Math.min(availableResources, 45); // Larger attack if can't kill
        }
        Logger.debug('Attacking betrayer with increased force', {
          playerId: target.playerId,
          attackSize,
          exactKillDamage
        });
      }
      
      // If enemy is our ally, attack smaller (minimal damage if we must attack)
      if (gameTheory.isAlly(gameId, target.playerId, turn)) {
        attackSize = Math.min(attackSize, 15); // Smaller attack
        Logger.debug('Attacking ally with reduced force', {
          playerId: target.playerId,
          attackSize,
          allianceTurns: gameTheory.getAllianceRecord(gameId, target.playerId)?.allianceTurns || 0
        });
      }
      
      // If enemy is likely to attack us, attack harder (preemptive) but don't overkill
      if (gameTheory.willLikelyAttackUs(gameId, target.playerId)) {
        if (exactKillDamage <= availableResources) {
          attackSize = Math.min(attackSize, exactKillDamage + 2);
        } else {
          attackSize = Math.min(availableResources, 40);
        }
      }
    }
    
    // Final bounds: minimum 5, maximum available resources
    // But prioritize exact kill damage if possible
    const finalAttackSize = Math.max(5, Math.min(attackSize, availableResources));
    
    Logger.debug('Final attack size calculation', {
      playerId: target.playerId,
      exactKillDamage,
      calculatedSize: attackSize,
      finalSize: finalAttackSize,
      availableResources,
      targetHP: target.hp,
      targetArmor: target.armor,
      willKill: finalAttackSize >= exactKillDamage,
      overkill: finalAttackSize > exactKillDamage ? finalAttackSize - exactKillDamage : 0
    });
    
    return finalAttackSize;
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
      
      // Calculate exact kill damage (HP + armor)
      const exactKillDamage = enemy.hp + enemy.armor;
      
      // Generate attack sizes, prioritizing exact kill damage
      const attackSizes = new Set<number>();
      
      // Always include exact kill damage if affordable
      if (exactKillDamage > 0 && exactKillDamage <= resources) {
        attackSizes.add(exactKillDamage);
        attackSizes.add(exactKillDamage + 1); // Small buffer
        attackSizes.add(exactKillDamage + 2); // Safety margin
      }
      
      // Add standard attack sizes (10, 20, 30)
      for (let troops = 10; troops <= Math.min(30, resources); troops += 10) {
        attackSizes.add(troops);
      }
      
      // Add larger attacks if we can't kill with standard sizes
      if (exactKillDamage > 30 && exactKillDamage <= resources) {
        // Add sizes around kill damage
        for (let offset = -10; offset <= 10; offset += 10) {
          const size = exactKillDamage + offset;
          if (size > 0 && size <= resources) {
            attackSizes.add(size);
          }
        }
      }
      
      // Convert to array and sort
      const sortedSizes = Array.from(attackSizes).sort((a, b) => a - b);
      
      for (const troops of sortedSizes) {
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
