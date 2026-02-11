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
  private enemyEstimates: Map<number, EnemyResourceEstimate> = new Map();
  private gameId: number | null = null;

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
    // Reset if new game
    if (this.gameId !== gameId) {
      this.enemyEstimates.clear();
      this.gameId = gameId;
    }

    // Process all actions from this turn
    const allActions = [...combatActions, ...previousAttacks];

    // Update each enemy
    enemyTowers.forEach(enemy => {
      const estimate = this.getOrCreateEstimate(enemy);

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
  private getOrCreateEstimate(enemy: Tower): EnemyResourceEstimate {
    if (!this.enemyEstimates.has(enemy.playerId)) {
      this.enemyEstimates.set(enemy.playerId, {
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
    return this.enemyEstimates.get(enemy.playerId)!;
  }

  /**
   * Get resource estimate for enemy
   */
  getEstimate(playerId: number): EnemyResourceEstimate | null {
    return this.enemyEstimates.get(playerId) || null;
  }

  /**
   * Get all estimates
   */
  getAllEstimates(): Map<number, EnemyResourceEstimate> {
    return this.enemyEstimates;
  }

  /**
   * Predict if enemy can afford upgrade
   */
  canAffordUpgrade(playerId: number): boolean {
    const estimate = this.getEstimate(playerId);
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
   * Clear estimates (for new game)
   */
  clear(): void {
    this.enemyEstimates.clear();
    this.gameId = null;
  }
}
