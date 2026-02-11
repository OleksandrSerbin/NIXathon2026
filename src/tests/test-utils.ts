import {
  NegotiateRequest,
  CombatRequest,
  Tower
} from '../types/kingdom-wars';

/**
 * Test utilities for creating sample game states
 */
export class TestUtils {
  /**
   * Create a sample negotiation request
   */
  static createNegotiateRequest(overrides?: Partial<NegotiateRequest>): NegotiateRequest {
    return {
      gameId: 123,
      turn: 1,
      playerTower: {
        playerId: 101,
        hp: 100,
        armor: 0,
        resources: 20,
        level: 1
      },
      enemyTowers: [
        { playerId: 102, hp: 95, armor: 3, level: 1 },
        { playerId: 103, hp: 80, armor: 10, level: 2 },
        { playerId: 104, hp: 90, armor: 5, level: 1 }
      ],
      combatActions: [],
      ...overrides
    };
  }

  /**
   * Create a sample combat request
   */
  static createCombatRequest(overrides?: Partial<CombatRequest>): CombatRequest {
    return {
      gameId: 123,
      turn: 1,
      playerTower: {
        playerId: 101,
        hp: 100,
        armor: 0,
        resources: 20,
        level: 1
      },
      enemyTowers: [
        { playerId: 102, hp: 95, armor: 3, level: 1 },
        { playerId: 103, hp: 80, armor: 10, level: 2 },
        { playerId: 104, hp: 90, armor: 5, level: 1 }
      ],
      diplomacy: [],
      previousAttacks: [],
      ...overrides
    };
  }

  /**
   * Create a tower with custom properties
   */
  static createTower(overrides?: Partial<Tower>): Tower {
    return {
      playerId: 101,
      hp: 100,
      armor: 0,
      level: 1,
      ...overrides
    };
  }

  /**
   * Create early game state
   */
  static createEarlyGameState(): NegotiateRequest {
    return this.createNegotiateRequest({
      turn: 5,
      playerTower: {
        playerId: 101,
        hp: 100,
        armor: 0,
        resources: 20,
        level: 1
      }
    });
  }

  /**
   * Create late game state (fatigue)
   */
  static createLateGameState(): NegotiateRequest {
    return this.createNegotiateRequest({
      turn: 30,
      playerTower: {
        playerId: 101,
        hp: 50,
        armor: 5,
        resources: 20,
        level: 2
      }
    });
  }

  /**
   * Create state with attacks on player
   */
  static createThreatState(): NegotiateRequest {
    return this.createNegotiateRequest({
      combatActions: [
        {
          playerId: 102,
          action: { targetId: 101, troopCount: 15 }
        },
        {
          playerId: 103,
          action: { targetId: 101, troopCount: 20 }
        }
      ]
    });
  }
}
