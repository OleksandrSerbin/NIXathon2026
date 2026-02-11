import { Tower, CombatAction } from '../types/kingdom-wars';
import { Logger } from '../utils/logger';

/**
 * Resource generation formula: 20 × (1.5 ^ (level - 1))
 */
function getResourceGeneration(level: number): number {
  return Math.floor(20 * Math.pow(1.5, level - 1));
}

/**
 * Upgrade cost formula: 50 × (1.75 ^ (level - 1))
 */
function getUpgradeCost(level: number): number {
  return Math.floor(50 * Math.pow(1.75, level - 1));
}

/**
 * Tracks enemy resource allocation and spending patterns
 * Estimates enemy resources to help plan our strategy
 */
export interface EnemyResourceEstimate {
  playerId: number;
  estimatedResources: number;
  resourceGeneration: number; // Per turn
  lastKnownLevel: number;
  lastKnownHP: number;
  lastKnownArmor: number;
  spendingPattern: {
    avgAttackSize: number;
    upgradeFrequency: number; // Upgrades per N turns
    armorFrequency: number; // Armor builds per N turns
    totalSpent: number;
    totalEarned: number;
  };
  actionHistory: Array<{
    turn: number;
    action: 'attack' | 'upgrade' | 'armor' | 'none';
    cost: number;
    level?: number; // If upgraded
  }>;
}

export class EnemyResourceTracker {
  // Track estimates per game: Map<gameId, Map<playerId, Estimate>>
  private gameEstimates: Map<number, Map<number, EnemyResourceEstimate>> = new Map();

  /**
   * Update estimates based on current game state and actions
   */
  updateEstimates(
    gameId: number,
    turn: number,
    enemyTowers: Tower[],
    combatActions: CombatAction[],
    previousAttacks: CombatAction[]
  ): void {
    // Get or create estimates map for this game
    if (!this.gameEstimates.has(gameId)) {
      this.gameEstimates.set(gameId, new Map());
    }
    const enemyEstimates = this.gameEstimates.get(gameId)!;

    // Process all actions from this turn
    const allActions = [...combatActions, ...previousAttacks];

    // Update each enemy (skip dead enemies)
    enemyTowers.forEach(enemy => {
      // Skip dead enemies (HP <= 0)
      if (enemy.hp <= 0) {
        return;
      }
      
      const estimate = this.getOrCreateEstimate(enemy, enemyEstimates);

      // Detect level changes (upgrades)
      if (enemy.level > estimate.lastKnownLevel) {
        const upgradeCost = getUpgradeCost(estimate.lastKnownLevel);
        estimate.spendingPattern.totalSpent += upgradeCost;
        estimate.actionHistory.push({
          turn,
          action: 'upgrade',
          cost: upgradeCost,
          level: enemy.level
        });
        estimate.spendingPattern.upgradeFrequency++;
        Logger.debug(`Enemy ${enemy.playerId} upgraded to level ${enemy.level}`, {
          cost: upgradeCost,
          turn
        });
      }

      // Detect armor changes
      if (enemy.armor > estimate.lastKnownArmor) {
        const armorCost = enemy.armor - estimate.lastKnownArmor;
        estimate.spendingPattern.totalSpent += armorCost;
        estimate.spendingPattern.armorFrequency++;
        estimate.actionHistory.push({
          turn,
          action: 'armor',
          cost: armorCost
        });
        Logger.debug(`Enemy ${enemy.playerId} built ${armorCost} armor`, { turn });
      }

      // Track attacks
      const enemyAttacks = allActions.filter(a => a.playerId === enemy.playerId);
      enemyAttacks.forEach(attack => {
        if (attack.action?.troopCount) {
          const attackCost = attack.action.troopCount;
          estimate.spendingPattern.totalSpent += attackCost;
          estimate.spendingPattern.avgAttackSize = 
            (estimate.spendingPattern.avgAttackSize * (estimate.actionHistory.length - 1) + attackCost) /
            estimate.actionHistory.length;
          estimate.actionHistory.push({
            turn,
            action: 'attack',
            cost: attackCost
          });
        }
      });

      // Update known state
      estimate.lastKnownLevel = enemy.level;
      estimate.lastKnownHP = enemy.hp;
      estimate.lastKnownArmor = enemy.armor;
      estimate.resourceGeneration = getResourceGeneration(enemy.level);

      // Estimate current resources
      this.estimateCurrentResources(estimate, turn);
    });
  }

  /**
   * Estimate enemy's current resources
   */
  private estimateCurrentResources(estimate: EnemyResourceEstimate, currentTurn: number): void {
    // Start with base estimate: assume they spent most resources last turn
    // But they regenerate each turn
    
    // Calculate total earned (approximate)
    const turnsTracked = estimate.actionHistory.length;
    if (turnsTracked > 0) {
      const avgGeneration = estimate.resourceGeneration;
      estimate.spendingPattern.totalEarned = avgGeneration * turnsTracked;
    }

    // Estimate: They regenerate resources each turn, then spend some
    // If we saw them attack with X troops, they had at least X resources
    const lastAction = estimate.actionHistory[estimate.actionHistory.length - 1];
    
    if (lastAction) {
      // They had at least enough for last action
      // Plus they regenerate each turn
      // Minus what they might have spent
      const minResources = lastAction.cost;
      const regenerated = estimate.resourceGeneration; // Per turn
      
      // Conservative estimate: assume they spend most resources
      // But regenerate each turn
      estimate.estimatedResources = Math.max(
        regenerated - estimate.spendingPattern.avgAttackSize,
        minResources
      );
    } else {
      // No history: assume they have full regeneration
      estimate.estimatedResources = estimate.resourceGeneration;
    }

    // Cap at reasonable maximum (2-3 turns of generation)
    estimate.estimatedResources = Math.min(
      estimate.estimatedResources,
      estimate.resourceGeneration * 3
    );
  }

  /**
   * Get or create estimate for enemy
   */
  private getOrCreateEstimate(enemy: Tower, estimates: Map<number, EnemyResourceEstimate>): EnemyResourceEstimate {
    if (!estimates.has(enemy.playerId)) {
      estimates.set(enemy.playerId, {
        playerId: enemy.playerId,
        estimatedResources: getResourceGeneration(enemy.level),
        resourceGeneration: getResourceGeneration(enemy.level),
        lastKnownLevel: enemy.level,
        lastKnownHP: enemy.hp,
        lastKnownArmor: enemy.armor,
        spendingPattern: {
          avgAttackSize: 0,
          upgradeFrequency: 0,
          armorFrequency: 0,
          totalSpent: 0,
          totalEarned: 0
        },
        actionHistory: []
      });
    }
    return estimates.get(enemy.playerId)!;
  }

  /**
   * Get resource estimate for enemy (from current/last game)
   * Note: For multi-game support, use getEstimateForGame()
   */
  getEstimate(playerId: number): EnemyResourceEstimate | null {
    // Return from most recent game (for backward compatibility)
    if (this.gameEstimates.size === 0) return null;
    const lastGameId = Array.from(this.gameEstimates.keys())[this.gameEstimates.size - 1];
    const estimates = this.gameEstimates.get(lastGameId);
    return estimates?.get(playerId) || null;
  }

  /**
   * Get resource estimate for enemy in specific game
   */
  getEstimateForGame(gameId: number, playerId: number): EnemyResourceEstimate | null {
    const estimates = this.gameEstimates.get(gameId);
    return estimates?.get(playerId) || null;
  }

  /**
   * Get all estimates for a specific game
   */
  getAllEstimatesForGame(gameId: number): Map<number, EnemyResourceEstimate> {
    return this.gameEstimates.get(gameId) || new Map();
  }

  /**
   * Get all estimates (from current/last game, for backward compatibility)
   */
  getAllEstimates(): Map<number, EnemyResourceEstimate> {
    if (this.gameEstimates.size === 0) return new Map();
    const lastGameId = Array.from(this.gameEstimates.keys())[this.gameEstimates.size - 1];
    return this.gameEstimates.get(lastGameId) || new Map();
  }

  /**
   * Predict if enemy can afford upgrade (from current/last game)
   */
  canAffordUpgrade(playerId: number): boolean {
    const estimate = this.getEstimate(playerId);
    if (!estimate) return false;
    
    const upgradeCost = getUpgradeCost(estimate.lastKnownLevel);
    return estimate.estimatedResources >= upgradeCost;
  }

  /**
   * Predict if enemy can afford upgrade in specific game
   */
  canAffordUpgradeForGame(gameId: number, playerId: number): boolean {
    const estimate = this.getEstimateForGame(gameId, playerId);
    if (!estimate) return false;
    
    const upgradeCost = getUpgradeCost(estimate.lastKnownLevel);
    return estimate.estimatedResources >= upgradeCost;
  }

  /**
   * Predict enemy's likely actions next turn
   */
  predictNextActions(playerId: number, turn: number): {
    willUpgrade: boolean;
    willBuildArmor: boolean;
    expectedAttackSize: number;
    likelyTargets: number[];
  } {
    const estimate = this.getEstimate(playerId);
    if (!estimate) {
      return {
        willUpgrade: false,
        willBuildArmor: false,
        expectedAttackSize: 0,
        likelyTargets: []
      };
    }

    const upgradeCost = getUpgradeCost(estimate.lastKnownLevel);
    const canUpgrade = estimate.estimatedResources >= upgradeCost;
    
    // Predict based on patterns
    const willUpgrade = canUpgrade && 
      (estimate.spendingPattern.upgradeFrequency > 0 || turn < 10);
    
    const willBuildArmor = estimate.lastKnownHP < 60 || turn >= 25;
    
    const expectedAttackSize = estimate.spendingPattern.avgAttackSize || 
      Math.floor(estimate.resourceGeneration * 0.5);

    return {
      willUpgrade,
      willBuildArmor,
      expectedAttackSize,
      likelyTargets: [] // Would need more context to predict targets
    };
  }

  /**
   * Get enemy spending efficiency (resources spent vs earned)
   */
  getSpendingEfficiency(playerId: number): number {
    const estimate = this.getEstimate(playerId);
    if (!estimate || estimate.spendingPattern.totalEarned === 0) {
      return 0;
    }
    return estimate.spendingPattern.totalSpent / estimate.spendingPattern.totalEarned;
  }

  /**
   * Clear estimates for a specific game
   */
  clearGame(gameId: number): void {
    this.gameEstimates.delete(gameId);
  }

  /**
   * Clear all estimates (for all games)
   */
  clear(): void {
    this.gameEstimates.clear();
  }
}
