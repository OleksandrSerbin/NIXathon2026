import {
  Tower,
  CombatRequest,
  CombatResponseAction,
  NegotiateRequest,
  NegotiateResponse
} from '../types/kingdom-wars';
import { Logger } from '../utils/logger';
import { EnemyResourceTracker } from './enemy-resource-tracker';

/**
 * Simulated game state for lookahead planning
 */
interface SimulatedState {
  playerTower: Tower;
  enemyTowers: Tower[];
  turn: number;
  resources: number;
  score: number; // Evaluation score
}

/**
 * Action sequence for planning
 */
interface ActionSequence {
  actions: CombatResponseAction[];
  expectedOutcome: SimulatedState;
  score: number;
}

/**
 * Multi-turn lookahead planner
 * Simulates future game states to make better decisions
 */
export class MultiTurnPlanner {
  private maxTurns: number;
  private resourceTracker: EnemyResourceTracker;

  constructor(maxTurns: number = 3, resourceTracker: EnemyResourceTracker) {
    this.maxTurns = maxTurns;
    this.resourceTracker = resourceTracker;
  }

  /**
   * Plan combat actions with multi-turn lookahead
   */
  planCombatActions(
    request: CombatRequest,
    possibleActions: CombatResponseAction[][]
  ): CombatResponseAction[] {
    if (possibleActions.length === 0) return [];
    if (possibleActions.length === 1) return possibleActions[0];

    const sequences: ActionSequence[] = [];

    // Evaluate each action sequence
    for (const actions of possibleActions) {
      const outcome = this.simulateSequence(request, actions, this.maxTurns);
      sequences.push({
        actions,
        expectedOutcome: outcome,
        score: outcome.score
      });
    }

    // Sort by score (higher is better)
    sequences.sort((a, b) => b.score - a.score);

    Logger.debug('Multi-turn lookahead results', {
      sequencesEvaluated: sequences.length,
      bestScore: sequences[0]?.score,
      worstScore: sequences[sequences.length - 1]?.score,
      bestActions: sequences[0]?.actions
    });

    return sequences[0]?.actions || possibleActions[0];
  }

  /**
   * Simulate action sequence forward N turns
   */
  private simulateSequence(
    request: CombatRequest,
    actions: CombatResponseAction[],
    turnsAhead: number
  ): SimulatedState {
    // Start with current state
    let state: SimulatedState = {
      playerTower: { ...request.playerTower },
      enemyTowers: request.enemyTowers.map(e => ({ ...e })),
      turn: request.turn,
      resources: request.playerTower.resources || 0,
      score: 0
    };

    // Apply our actions
    state = this.applyActions(state, actions);

    // Simulate future turns
    for (let turn = 0; turn < turnsAhead; turn++) {
      state.turn++;
      
      // Regenerate resources
      state.resources += this.getResourceGeneration(state.playerTower.level);
      state.playerTower.resources = state.resources;

      // Simulate opponent actions
      state = this.simulateOpponentActions(request.gameId, state);

      // Apply fatigue (turn 25+)
      if (state.turn >= 25) {
        const fatigueDamage = (state.turn - 25) * 2;
        state.playerTower.hp = Math.max(0, state.playerTower.hp - fatigueDamage);
        state.enemyTowers.forEach(enemy => {
          enemy.hp = Math.max(0, enemy.hp - fatigueDamage);
        });
      }

      // Evaluate state
      state.score = this.evaluateState(state);
    }

    return state;
  }

  /**
   * Apply actions to game state
   */
  private applyActions(state: SimulatedState, actions: CombatResponseAction[]): SimulatedState {
    let resources = state.resources;

    for (const action of actions) {
      const cost = this.getActionCost(action, state.playerTower.level);
      if (resources < cost) continue; // Can't afford

      resources -= cost;

      if (action.type === 'upgrade') {
        state.playerTower.level++;
      } else if (action.type === 'armor') {
        state.playerTower.armor = (state.playerTower.armor || 0) + (action.amount || 0);
      } else if (action.type === 'attack') {
        const target = state.enemyTowers.find(e => e.playerId === action.targetId);
        // Skip attacking dead enemies (HP <= 0)
        if (target && target.hp <= 0) {
          continue; // Don't waste resources on dead enemies
        }
        if (target) {
          const damage = action.troopCount || 0;
          // Damage armor first, then HP
          const armorDamage = Math.min(damage, target.armor);
          target.armor = Math.max(0, target.armor - armorDamage);
          const remainingDamage = damage - armorDamage;
          if (remainingDamage > 0) {
            target.hp = Math.max(0, target.hp - remainingDamage);
          }
        }
      }
    }

    state.resources = resources;
    state.playerTower.resources = resources;
    return state;
  }

  /**
   * Simulate opponent actions probabilistically
   */
  private simulateOpponentActions(gameId: number, state: SimulatedState): SimulatedState {
    for (const enemy of state.enemyTowers) {
      // Skip dead enemies (HP <= 0)
      if (enemy.hp <= 0) continue;

      const estimate = this.resourceTracker.getEstimateForGame(gameId, enemy.playerId);
      let enemyResources = estimate?.estimatedResources || this.getResourceGeneration(enemy.level);

      // Simulate upgrade (30% chance if can afford)
      if (Math.random() < 0.3) {
        const upgradeCost = this.getUpgradeCost(enemy.level);
        if (enemyResources >= upgradeCost) {
          enemy.level++;
          enemyResources -= upgradeCost;
        }
      }

      // Simulate armor (40% chance)
      if (Math.random() < 0.4 && enemyResources > 0) {
        const armorAmount = Math.min(10, enemyResources);
        enemy.armor = (enemy.armor || 0) + armorAmount;
        enemyResources -= armorAmount;
      }

      // Simulate attack on us (50% chance)
      if (Math.random() < 0.5 && enemyResources > 0) {
        const attackSize = Math.min(
          enemyResources,
          estimate?.spendingPattern.avgAttackSize || enemyResources * 0.5
        );
        const damage = attackSize;
        // Damage our armor first, then HP
        const armorDamage = Math.min(damage, state.playerTower.armor);
        state.playerTower.armor = Math.max(0, state.playerTower.armor - armorDamage);
        const remainingDamage = damage - armorDamage;
        if (remainingDamage > 0) {
          state.playerTower.hp = Math.max(0, state.playerTower.hp - remainingDamage);
        }
      }
    }

    return state;
  }

  /**
   * Evaluate game state (higher = better for us)
   */
  private evaluateState(state: SimulatedState): number {
    let score = 0;

    // Our state (positive) - PRIORITY: Survival > Defense > Level > Resources
    const hp = state.playerTower.hp;
    const armor = state.playerTower.armor || 0;
    
    // HP scoring (survival priority - heavily penalize low HP)
    if (hp <= 0) {
      score -= 100000; // Death is catastrophic
    } else if (hp < 30) {
      score += hp * 50; // CRITICAL: Very low HP
    } else if (hp < 50) {
      score += hp * 30; // HIGH: Low HP
    } else if (hp < 70) {
      score += hp * 20; // MEDIUM: Moderate HP
    } else {
      score += hp * 10; // NORMAL: Good HP
    }
    
    // Armor scoring (defense priority - more valuable when HP is low)
    if (hp < 50) {
      score += armor * 15; // Armor is very valuable when HP is low
    } else if (hp < 70) {
      score += armor * 10; // Armor is valuable when HP is moderate
    } else {
      score += armor * 5; // Armor is nice to have when HP is high
    }
    
    score += state.playerTower.level * 50;
    score += state.resources * 2;

    // Enemy states (negative)
    for (const enemy of state.enemyTowers) {
      if (enemy.hp <= 0) {
        score += 100; // Bonus for eliminated enemy
      } else {
        score -= enemy.hp * 8;
        score -= enemy.armor * 4;
        score -= enemy.level * 40;
      }
    }

    // Survival bonus
    if (state.playerTower.hp > 0) {
      score += 50;
    } else {
      score -= 10000; // Death penalty
    }

    // Late game considerations
    if (state.turn >= 25) {
      // Bonus for being ahead
      const aliveEnemies = state.enemyTowers.filter(e => e.hp > 0).length;
      score += (4 - aliveEnemies) * 200;
    }

    return score;
  }

  /**
   * Predict future resource usage and damage over next N turns
   * Returns predictions for resources, HP, and damage
   */
  predictFutureState(
    request: CombatRequest,
    currentActions: CombatResponseAction[] = []
  ): {
    expectedResources: number;
    expectedHP: number;
    expectedDamage: number;
    expectedResourceSpending: number;
    expectedResourceGeneration: number;
    resourceGenerationPerTurn: number[]; // Resource generation for each turn
    minResources: number; // Minimum resources we'll have
    safeToUpgrade: boolean; // Can we afford upgrade and still be safe?
    finalLevel: number; // Final level after lookahead (accounts for upgrades)
  } {
    // Simulate current turn with given actions
    let state: SimulatedState = {
      playerTower: { ...request.playerTower },
      enemyTowers: request.enemyTowers.map(e => ({ ...e })),
      turn: request.turn,
      resources: request.playerTower.resources || 0,
      score: 0
    };

    // Apply current actions
    if (currentActions.length > 0) {
      state = this.applyActions(state, currentActions);
    }

    const initialResources = state.resources;
    const initialHP = state.playerTower.hp;
    let totalDamage = 0;
    let totalSpending = 0;
    let minResources = state.resources;
    const resourceGenerations: number[] = [];

    // Simulate next N turns
    for (let turn = 0; turn < this.maxTurns; turn++) {
      state.turn++;
      
      // Regenerate resources
      const generation = this.getResourceGeneration(state.playerTower.level);
      state.resources += generation;
      state.playerTower.resources = state.resources;
      resourceGenerations.push(generation);

      // Simulate opponent actions (predict damage and resource needs)
      const beforeHP = state.playerTower.hp;
      const beforeResources = state.resources;
      
      state = this.simulateOpponentActions(request.gameId, state);
      
      // Calculate damage taken
      const damageTaken = beforeHP - state.playerTower.hp;
      totalDamage += damageTaken;

      // Predict our resource spending (simulate typical actions)
      const predictedSpending = this.predictOurSpending(state, request.turn + turn);
      totalSpending += predictedSpending;
      state.resources = Math.max(0, state.resources - predictedSpending);
      
      // Track minimum resources
      minResources = Math.min(minResources, state.resources);

      // Apply fatigue (turn 25+)
      if (state.turn >= 25) {
        const fatigueDamage = (state.turn - 25) * 2;
        state.playerTower.hp = Math.max(0, state.playerTower.hp - fatigueDamage);
        totalDamage += fatigueDamage;
      }
    }

    const expectedResourceGeneration = resourceGenerations.reduce((sum, gen) => sum + gen, 0);
    const expectedResources = state.resources;
    const expectedHP = state.playerTower.hp;
    const finalLevel = state.playerTower.level; // Final level after lookahead (accounts for upgrades)
    
    // Determine if safe to upgrade
    // Safe if: HP will be > 50, and we'll have enough resources for essential actions
    const safeToUpgrade = expectedHP > 50 && minResources >= 20; // Keep at least 20 for emergencies

    // Log resource generation details if upgrade was applied
    const hasUpgrade = currentActions.some(a => a.type === 'upgrade');
    if (hasUpgrade) {
      const initialLevel = request.playerTower.level;
      const levelIncrease = finalLevel - initialLevel;
      const initialGen = this.getResourceGeneration(initialLevel);
      const finalGen = this.getResourceGeneration(finalLevel);
      const genIncreasePerTurn = finalGen - initialGen;
      const totalGenIncrease = genIncreasePerTurn * this.maxTurns;
      
      Logger.debug('Upgrade resource generation calculation', {
        initialLevel,
        finalLevel,
        levelIncrease,
        initialGenPerTurn: initialGen,
        finalGenPerTurn: finalGen,
        genIncreasePerTurn,
        totalGenIncrease,
        turnsSimulated: this.maxTurns,
        resourceGenerationsPerTurn: resourceGenerations,
        totalResourceGeneration: expectedResourceGeneration
      });
    }

    return {
      expectedResources,
      expectedHP,
      expectedDamage: totalDamage,
      expectedResourceSpending: totalSpending,
      expectedResourceGeneration,
      resourceGenerationPerTurn: resourceGenerations, // Per-turn breakdown
      minResources,
      safeToUpgrade,
      finalLevel // Final level after lookahead
    };
  }

  /**
   * Predict our resource spending in a future turn
   * PRIORITY: Defense (Survival) > Attack > Upgrade
   */
  private predictOurSpending(state: SimulatedState, turn: number): number {
    let spending = 0;
    const resources = state.resources;
    const hp = state.playerTower.hp;
    const armor = state.playerTower.armor || 0;

    // PRIORITY 1: Defense/Armor (Survival is main goal)
    // IMPROVED: More proactive defense strategy
    // CRITICAL: Very low HP - prioritize armor heavily
    if (hp < 30 && armor < 20) {
      spending += Math.min(10, resources * 0.5); // Spend up to 50% on armor
    }
    // HIGH: Low HP - prioritize armor proactively
    else if (hp < 50 && armor < 15) {
      spending += Math.min(10, resources * 0.5); // Spend up to 50% on armor
    }
    // MEDIUM-HIGH: Moderate HP - build armor proactively
    else if (hp < 60 && armor < 10) {
      spending += Math.min(10, resources * 0.4); // Spend up to 40% on armor
    }
    // LATE GAME: Fatigue damage requires armor - BUILD MAX
    else if (turn >= 25 && armor < 15) {
      spending += Math.min(10, resources * 0.4); // Spend up to 40% on armor (higher target)
    }
    // PREPARE FOR LATE GAME: Turn 20-24, build armor buffer
    else if (turn >= 20 && turn < 25 && armor < 10) {
      spending += Math.min(10, resources * 0.3); // Spend up to 30% on armor
    }
    // MEDIUM: Low armor maintenance
    else if (armor < 5 && hp > 60) {
      spending += Math.min(5, resources * 0.2); // Spend up to 20% on minimal armor
    }

    // PRIORITY 2: Attack (only if we have enough HP/armor)
    const remaining = resources - spending;
    if (remaining > 0 && hp > 40) { // Only attack if HP is safe
      // Typical attack: 20-30% of remaining resources
      const attackSize = Math.min(30, Math.floor(remaining * 0.25));
      spending += attackSize;
    }

    return spending;
  }

  /**
   * Plan negotiation with multi-turn lookahead
   */
  planNegotiation(
    request: NegotiateRequest,
    possibleResponses: NegotiateResponse[][]
  ): NegotiateResponse[] {
    if (possibleResponses.length === 0) return [];
    if (possibleResponses.length === 1) return possibleResponses[0];

    // For negotiation, we evaluate based on future combat outcomes
    // This is simpler than combat planning
    const bestResponse = possibleResponses[0]; // Default to first

    // Could enhance this to simulate future negotiation rounds
    // For now, return the first (will be improved by Game Theory)

    return bestResponse;
  }

  /**
   * Helper methods
   */
  private getResourceGeneration(level: number): number {
    return Math.floor(20 * Math.pow(1.5, level - 1));
  }

  private getUpgradeCost(level: number): number {
    return Math.floor(50 * Math.pow(1.75, level - 1));
  }

  private getActionCost(action: CombatResponseAction, level: number): number {
    if (action.type === 'upgrade') {
      return this.getUpgradeCost(level);
    } else if (action.type === 'armor') {
      return action.amount || 0;
    } else if (action.type === 'attack') {
      return action.troopCount || 0;
    }
    return 0;
  }
}
