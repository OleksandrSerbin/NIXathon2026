// Kingdom Wars game types

export interface Tower {
  playerId: number;
  hp: number;
  armor: number;
  resources?: number;
  level: number;
}

export interface NegotiateRequest {
  gameId: number;
  turn: number;
  playerTower: Tower;
  enemyTowers: Tower[];
  combatActions: CombatAction[];
}

export interface NegotiateResponse {
  allyId?: number;
  attackTargetId?: number;
}

export interface CombatRequest {
  gameId: number;
  turn: number;
  playerTower: Tower;
  enemyTowers: Tower[];
  diplomacy: DiplomacyAction[];
  previousAttacks: CombatAction[];
}

export interface CombatAction {
  playerId: number;
  action: {
    targetId?: number;
    troopCount?: number;
  };
}

export interface DiplomacyAction {
  playerId: number;
  action: {
    allyId: number;
    attackTargetId?: number;
  };
}

export type CombatActionType = 'armor' | 'attack' | 'upgrade';

export interface CombatResponseAction {
  type: CombatActionType;
  amount?: number; // For armor
  targetId?: number; // For attack
  troopCount?: number; // For attack
}

export interface BotInfo {
  name: string;
  strategy: string;
  version: string;
}
