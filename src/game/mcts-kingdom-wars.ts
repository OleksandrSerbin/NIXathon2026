import {
  CombatRequest,
  CombatResponseAction,
  Tower
} from '../types/kingdom-wars';
import { TimeManager } from '../utils/time-manager';
import { Logger } from '../utils/logger';
import { GameTheoryNegotiation } from './game-theory-negotiation';
import { EnemyResourceTracker } from './enemy-resource-tracker';

/**
 * MCTS Node for Kingdom Wars
 * Each node represents a sequence of actions
 */
class MCTSNode {
  public visits: number = 0;
  public wins: number = 0;
  public actionSequence: CombatResponseAction[];
  public children: MCTSNode[] = [];
  public parent: MCTSNode | null = null;
  public untriedSequences: CombatResponseAction[][];

  constructor(
    actionSequence: CombatResponseAction[],
    untriedSequences: CombatResponseAction[][],
    parent: MCTSNode | null = null
  ) {
    this.actionSequence = actionSequence;
    this.untriedSequences = [...untriedSequences];
    this.parent = parent;
  }

  /**
   * Calculate UCB1 value for node selection
   */
  ucb1(explorationConstant: number): number {
    if (this.visits === 0) return Infinity;
    if (!this.parent) return this.wins / this.visits;
    
    const exploitation = this.wins / this.visits;
    const exploration = explorationConstant * Math.sqrt(
      Math.log(this.parent.visits) / this.visits
    );
    return exploitation + exploration;
  }

  /**
   * Check if node is fully expanded
   */
  isFullyExpanded(): boolean {
    return this.untriedSequences.length === 0;
  }

  /**
   * Check if node is terminal (no children possible)
   */
  isTerminal(): boolean {
    return this.children.length === 0 && this.untriedSequences.length === 0;
  }
}

/**
 * Monte Carlo Tree Search for Kingdom Wars Combat Phase
 * 
 * Handles uncertainty about opponent actions and evaluates
 * different action combinations probabilistically.
 */
export class MCTSKingdomWars {
  private iterations: number;
  private explorationConstant: number;
  private timeManager?: TimeManager;
  private playerTower!: Tower; // Initialized in calculateBestActions
  private enemyTowers!: Tower[]; // Initialized in calculateBestActions
  private turn!: number; // Initialized in calculateBestActions
  private gameTheory: GameTheoryNegotiation | null = null;
  private resourceTracker: EnemyResourceTracker | null = null;
  private gameId: number = 0;

  constructor(
    iterations: number = 500,
    explorationConstant: number = 1.41,
    timeLimitMs?: number
  ) {
    this.iterations = iterations;
    this.explorationConstant = explorationConstant;
    if (timeLimitMs) {
      this.timeManager = new TimeManager(timeLimitMs, timeLimitMs * 0.9);
    }
  }

  /**
   * Set Game Theory and Resource Tracker for better decision making
   */
  setHelpers(
    gameTheory: GameTheoryNegotiation | null,
    resourceTracker: EnemyResourceTracker | null
  ): void {
    this.gameTheory = gameTheory;
    this.resourceTracker = resourceTracker;
  }

  /**
   * Calculate best combat actions using MCTS
   */
  calculateBestActions(request: CombatRequest): CombatResponseAction[] {
    this.playerTower = request.playerTower;
    this.enemyTowers = request.enemyTowers;
    this.turn = request.turn;
    this.gameId = request.gameId;

    if (this.timeManager) {
      this.timeManager.reset();
    }

    // Generate all possible action combinations
    const allActionCombinations = this.generateAllActionCombinations(request);
    if (allActionCombinations.length === 0) return [];

    // If only one option, return it
    if (allActionCombinations.length === 1) return allActionCombinations[0];

    // Create root node with empty sequence
    const root = new MCTSNode([], allActionCombinations);

    // Run MCTS iterations
    let iterationsRun = 0;
    for (let i = 0; i < this.iterations; i++) {
      if (this.timeManager && this.timeManager.shouldStop()) {
        break;
      }

      // Selection: Choose path to leaf node
      let node = this.select(root);

      // Expansion: Add new child if possible
      if (!node.isTerminal() && node.untriedSequences.length > 0) {
        node = this.expand(node);
      }

      // Simulation: Play random game to end
      const result = this.simulate(node);

      // Backpropagation: Update statistics
      this.backpropagate(node, result);

      iterationsRun++;
    }

    Logger.debug('MCTS completed', {
      iterations: iterationsRun,
      totalNodes: this.countNodes(root)
    });

    // Return best action sequence (most visited child)
    if (root.children.length === 0) {
      // Fallback to first combination if no children
      return allActionCombinations[0];
    }

    const bestChild = root.children.reduce((best, child) => {
      return child.visits > best.visits ? child : best;
    }, root.children[0]);

    return bestChild ? bestChild.actionSequence : allActionCombinations[0];
  }

  /**
   * Selection: Traverse tree using UCB1
   */
  private select(node: MCTSNode): MCTSNode {
    while (!node.isTerminal()) {
      if (!node.isFullyExpanded()) {
        return node;
      } else if (node.children.length > 0) {
        // Choose best child using UCB1
        node = node.children.reduce((best, child) => {
          const bestUCB = best.ucb1(this.explorationConstant);
          const childUCB = child.ucb1(this.explorationConstant);
          return childUCB > bestUCB ? child : best;
        }, node.children[0]);
      } else {
        return node;
      }
    }
    return node;
  }

  /**
   * Expansion: Add new child node
   */
  private expand(node: MCTSNode): MCTSNode {
    if (node.untriedSequences.length === 0) return node;

    // Pick random untried sequence
    const randomIndex = Math.floor(Math.random() * node.untriedSequences.length);
    const sequence = node.untriedSequences.splice(randomIndex, 1)[0];

    // Create new child node with combined sequence
    const childSequence = [...node.actionSequence, ...sequence];
    const child = new MCTSNode(childSequence, [], node);
    node.children.push(child);

    return child;
  }

  /**
   * Simulation: Play random game to completion
   */
  private simulate(node: MCTSNode): number {
    // Simulate game state after applying actions
    let simulatedTower = { ...this.playerTower };
    let simulatedEnemies = this.enemyTowers.map(e => ({ ...e }));

    // Apply our actions
    for (const action of node.actionSequence) {
      this.applyActionToState(action, simulatedTower, simulatedEnemies);
    }

    // Simulate opponent actions (random)
    for (const enemy of simulatedEnemies) {
      const randomOpponentActions = this.generateRandomOpponentActions(
        enemy,
        simulatedTower
      );
      for (const action of randomOpponentActions) {
        this.applyOpponentAction(action, enemy, simulatedTower);
      }
    }

    // Evaluate final state
    return this.evaluateState(simulatedTower, simulatedEnemies);
  }

  /**
   * Backpropagation: Update node statistics
   */
  private backpropagate(node: MCTSNode, result: number): void {
    let current: MCTSNode | null = node;
    while (current) {
      current.visits++;
      if (result > 0) {
        current.wins += result;
      }
      current = current.parent;
    }
  }

  /**
   * Generate all possible action combinations
   */
  private generateAllActionCombinations(request: CombatRequest): CombatResponseAction[][] {
    const { playerTower } = request;
    const resources = playerTower.resources || 0;
    const combinations: CombatResponseAction[][] = [];

    // Generate possible actions
    const possibleActions: CombatResponseAction[] = [];

    // Upgrade action - consider saving resources for upgrades
    const upgradeCost = this.getUpgradeCost(playerTower.level);
    const shouldUpgradeNow = this.shouldUpgrade(playerTower, request.enemyTowers, request.turn);
    
    // If we can afford upgrade and should upgrade, add it
    if (resources >= upgradeCost && shouldUpgradeNow) {
      possibleActions.push({ type: 'upgrade' });
    }
    
    // Also consider saving resources for future upgrades
    // If we're close to upgrade cost, consider saving some resources
    if (upgradeCost > resources && resources >= upgradeCost * 0.6) {
      // We're 60%+ of the way to upgrade, consider saving
      // This will be handled by action combinations (not spending all resources)
    }

    // Armor actions (different amounts) - PRIORITY: Survival
    if (this.shouldBuildArmor(playerTower, request.turn)) {
      const currentArmor = playerTower.armor || 0;
      const hp = playerTower.hp;
      
      // Calculate recommended armor amount based on HP
      // IMPROVED: More aggressive armor targets
      let targetArmor = 10; // Default target
      if (hp < 30) {
        targetArmor = 20; // CRITICAL: Very low HP, need more armor
      } else if (hp < 50) {
        targetArmor = 15; // HIGH: Low HP, need good armor
      } else if (hp < 60) {
        targetArmor = 10; // MEDIUM: Moderate HP, build proactively
      } else if (request.turn >= 25) {
        targetArmor = 15; // LATE GAME: Higher target for fatigue damage
      } else if (request.turn >= 20) {
        targetArmor = 10; // PREPARE: Build buffer for late game
      }
      
      const neededArmor = Math.max(0, targetArmor - currentArmor);
      const maxArmor = Math.min(neededArmor, resources, 10); // Max 10 per turn
      
      // Generate armor actions: full amount, half amount, minimal amount
      if (maxArmor >= 10) {
        possibleActions.push({ type: 'armor', amount: 10 });
        possibleActions.push({ type: 'armor', amount: 5 });
      } else if (maxArmor >= 5) {
        possibleActions.push({ type: 'armor', amount: maxArmor });
        possibleActions.push({ type: 'armor', amount: Math.floor(maxArmor / 2) });
      } else if (maxArmor > 0) {
        possibleActions.push({ type: 'armor', amount: maxArmor });
      }
    }

    // Attack actions (different targets and amounts)
    // Skip dead enemies (HP <= 0) and allies
    for (const enemy of request.enemyTowers) {
      // Skip dead enemies
      if (enemy.hp <= 0) {
        continue;
      }
      
      // Skip allies (Game Theory trust system)
      // Give trust credit at beginning (turn 0-1), use history from turn 2+
      let isAlly = false;
      if (this.gameTheory) {
        // Pass turn to isAlly for trust system
        isAlly = this.gameTheory.isAlly(this.gameId, enemy.playerId, request.turn);
      }
      
      if (isAlly) {
        Logger.debug('MCTS: Skipping attack on ally', {
          playerId: enemy.playerId,
          turn: request.turn,
          allianceTurns: this.gameTheory?.getAllianceRecord(this.gameId, enemy.playerId)?.allianceTurns || 0
        });
        continue; // Don't attack allies
      }
      
      // Calculate exact kill damage (HP + armor)
      const exactKillDamage = enemy.hp + enemy.armor;
      
      // Generate attack sizes, prioritizing exact kill damage
      const attackSizes = new Set<number>();
      
      // PRIORITY: Always include exact kill damage if affordable (avoid overkill)
      if (exactKillDamage > 0 && exactKillDamage <= resources) {
        attackSizes.add(exactKillDamage); // Exact kill
        attackSizes.add(exactKillDamage + 1); // Small buffer
        attackSizes.add(exactKillDamage + 2); // Safety margin
        // Don't add larger sizes - avoid overkill!
      }
      
      // Add standard attack sizes only if we can't kill with exact damage
      if (exactKillDamage > resources || exactKillDamage === 0) {
        // Can't afford exact kill or already dead, use standard sizes
        for (let troops = 5; troops <= Math.min(30, resources); troops += 5) {
          attackSizes.add(troops);
        }
      } else {
        // Can afford exact kill, but also include smaller sizes for flexibility
        // (in case we want to save resources)
        for (let troops = 5; troops < exactKillDamage && troops <= resources; troops += 5) {
          attackSizes.add(troops);
        }
      }
      
      // Add larger attacks only if exact kill is not affordable
      if (exactKillDamage > 30 && exactKillDamage <= resources) {
        // Add sizes around kill damage
        for (let offset = -5; offset <= 5; offset += 5) {
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
      const cost = this.getActionCost(action);
      if (cost <= resources) {
        combinations.push([action]);

        // Try to add second action if resources allow
        const remaining = resources - cost;
        for (const secondAction of possibleActions) {
          if (action === secondAction) continue;
          const secondCost = this.getActionCost(secondAction);
          if (secondCost <= remaining && this.isValidCombination([action, secondAction])) {
            combinations.push([action, secondAction]);
          }
        }
      }
    }
    
    // Consider saving resources for upgrades
    // If we're close to upgrade cost, add option to save resources
    const nextUpgradeCost = this.getUpgradeCost(playerTower.level);
    if (nextUpgradeCost > resources && resources >= nextUpgradeCost * 0.6) {
      // We're 60%+ of the way to upgrade, consider saving
      // Add empty action (save all) or minimal actions
      combinations.push([]); // Save all resources
      
      // Also add minimal attack/armor to save most resources
      if (possibleActions.some(a => a.type === 'armor')) {
        combinations.push([{ type: 'armor', amount: 5 }]); // Minimal armor
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

  /**
   * Apply action to game state
   */
  private applyActionToState(
    action: CombatResponseAction,
    tower: Tower,
    enemies: Tower[]
  ): void {
    const cost = this.getActionCost(action);
    tower.resources = (tower.resources || 0) - cost;

    if (action.type === 'upgrade') {
      tower.level++;
    } else if (action.type === 'armor') {
      tower.armor = (tower.armor || 0) + (action.amount || 0);
    } else if (action.type === 'attack') {
      const target = enemies.find(e => e.playerId === action.targetId);
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

  /**
   * Generate random opponent actions for simulation
   */
  private generateRandomOpponentActions(
    opponent: Tower,
    playerTower: Tower
  ): CombatResponseAction[] {
    const actions: CombatResponseAction[] = [];
    let resources = opponent.resources || 0;

    // Randomly decide to upgrade (30% chance if can afford)
    if (Math.random() < 0.3 && resources >= this.getUpgradeCost(opponent.level)) {
      actions.push({ type: 'upgrade' });
      resources -= this.getUpgradeCost(opponent.level);
    }

    // Randomly build armor (40% chance)
    if (Math.random() < 0.4 && resources > 0) {
      const amount = Math.min(Math.floor(Math.random() * 10) + 1, resources);
      actions.push({ type: 'armor', amount });
      resources -= amount;
    }

    // Randomly attack player (50% chance if resources available)
    if (Math.random() < 0.5 && resources > 0) {
      const troops = Math.min(Math.floor(Math.random() * resources) + 1, resources);
      actions.push({
        type: 'attack',
        targetId: playerTower.playerId,
        troopCount: troops
      });
    }

    return actions;
  }

  /**
   * Apply opponent action to state
   */
  private applyOpponentAction(
    action: CombatResponseAction,
    opponent: Tower,
    playerTower: Tower
  ): void {
    if (action.type === 'attack' && action.targetId === playerTower.playerId) {
      const damage = action.troopCount || 0;
      // Damage armor first, then HP
      const armorDamage = Math.min(damage, playerTower.armor);
      playerTower.armor = Math.max(0, playerTower.armor - armorDamage);
      const remainingDamage = damage - armorDamage;
      if (remainingDamage > 0) {
        playerTower.hp = Math.max(0, playerTower.hp - remainingDamage);
      }
    }
  }

  /**
   * Evaluate game state (higher = better for us)
   * PRIORITY: Survival > Defense > Attack > Upgrade
   */
  private evaluateState(playerTower: Tower, enemies: Tower[]): number {
    const hp = playerTower.hp;
    const armor = playerTower.armor || 0;
    const level = playerTower.level;
    const resources = playerTower.resources || 0;
    
    // CRITICAL: Survival is the main goal - heavily penalize low HP
    let score = 0;
    
    // HP scoring (survival priority)
    if (hp <= 0) {
      return -100000; // Death is catastrophic
    } else if (hp < 30) {
      score += hp * 50; // CRITICAL: Very low HP, survival is everything
    } else if (hp < 50) {
      score += hp * 30; // HIGH: Low HP, prioritize survival
    } else if (hp < 70) {
      score += hp * 20; // MEDIUM: Moderate HP
    } else {
      score += hp * 10; // NORMAL: Good HP
    }
    
    // Armor scoring (defense priority) - more valuable when HP is low
    if (hp < 50) {
      score += armor * 15; // Armor is very valuable when HP is low
    } else if (hp < 70) {
      score += armor * 10; // Armor is valuable when HP is moderate
    } else {
      score += armor * 5; // Armor is nice to have when HP is high
    }
    
    // Level scoring (resource generation)
    score += level * 50;
    
    // Resources scoring (less important than survival)
    score += resources * 2;

    // Bonus for saving resources when close to upgrade (only if safe)
    if (hp > 50) {
      const upgradeCost = this.getUpgradeCost(level);
      if (upgradeCost > resources && resources >= upgradeCost * 0.6) {
        const progressToUpgrade = resources / upgradeCost;
        score += progressToUpgrade * 30;
      }
    }

    // Subtract enemy strength
    for (const enemy of enemies) {
      if (enemy.hp > 0) {
        score -= enemy.hp * 8;
        score -= enemy.armor * 4;
        score -= enemy.level * 40;
      }
    }

    // Bonus for eliminating enemies
    const aliveEnemies = enemies.filter(e => e.hp > 0).length;
    score += (4 - aliveEnemies) * 100;
    
    // Survival bonus: Extra points for being alive with good HP/armor
    if (hp > 50 && armor > 5) {
      score += 100; // Survival bonus
    }

    return score;
  }

  /**
   * Get action cost
   */
  private getActionCost(action: CombatResponseAction): number {
    if (action.type === 'upgrade') {
      return this.getUpgradeCost(this.playerTower.level);
    } else if (action.type === 'armor') {
      return action.amount || 0;
    } else if (action.type === 'attack') {
      return action.troopCount || 0;
    }
    return 0;
  }

  /**
   * Helper methods (same as in kingdom-wars-handler)
   */
  /**
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
    const isVeryBehind = level < avgEnemyLevel - 0.5;
    
    // CRITICAL: Very early game (turns 0-5) - upgrade ASAP if safe
    if (turn <= 5 && hp > 60) {
      return true; // Aggressive early upgrade
    }
    
    // HIGH PRIORITY: Early game (turns 6-10) - upgrade if safe
    if (turn <= 10 && hp > 55) {
      return true; // Upgrade early for resource generation advantage
    }
    
    // MEDIUM PRIORITY: Mid game (turns 11-20) - upgrade if safe or behind
    if (turn <= 20 && hp > 50) {
      return isBehind || hp > 60; // Upgrade if behind or very safe
    }
    
    // LATE GAME: Only upgrade if very behind (resource generation critical)
    if (turn > 20) {
      return isVeryBehind && hp > 50; // Only if significantly behind
    }
    
    return false;
  }

  /**
   * Enhanced armor decision prioritizing survival
   * Main goal: Stay alive - build armor when needed for survival
   * IMPROVED: More proactive defense strategy
   */
  private shouldBuildArmor(playerTower: Tower, turn: number): boolean {
    const hp = playerTower.hp;
    const armor = playerTower.armor || 0;
    
    // CRITICAL: Very low HP - always build armor if possible
    if (hp < 30) {
      return armor < 20; // Try to get to 20 armor
    }
    
    // HIGH PRIORITY: Low HP - build armor proactively
    if (hp < 50) {
      return armor < 15; // Try to get to 15 armor
    }
    
    // MEDIUM-HIGH PRIORITY: Moderate HP - build armor proactively
    if (hp < 60) {
      return armor < 10; // Build armor proactively, not reactively
    }
    
    // LATE GAME: Fatigue damage requires armor - BUILD MAX
    if (turn >= 25) {
      return armor < 15; // Higher target (15) for late game
    }
    
    // PREPARE FOR LATE GAME: Turn 20-24, build armor buffer
    if (turn >= 20 && turn < 25) {
      return armor < 10; // Prepare for late game
    }
    
    // MEDIUM PRIORITY: Low armor maintenance
    if (armor < 5 && hp > 60) {
      return true; // Build minimal armor
    }
    
    return false;
  }

  private getUpgradeCost(level: number): number {
    return Math.floor(50 * Math.pow(1.75, level - 1));
  }

  /**
   * Count total nodes in tree (for debugging)
   */
  private countNodes(node: MCTSNode): number {
    let count = 1;
    for (const child of node.children) {
      count += this.countNodes(child);
    }
    return count;
  }
}
