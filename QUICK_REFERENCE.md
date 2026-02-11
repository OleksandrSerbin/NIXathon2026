# Quick Reference - Game AI Hackathon

## 🚀 Immediate Actions When Game Rules Are Revealed

### 1. Update Game Types (5 min)
```typescript
// src/types/game.ts
export interface GameState {
  // Add actual game state fields here
  board?: any[][];
  players?: Player[];
  currentPlayer?: number;
  // ... etc
}
```

### 2. Implement Core Functions (30-60 min)
```typescript
// src/game/ai-strategies.ts
// Fill in these methods in your chosen strategy class:

getPossibleMoves(state: GameState): GameMove[] {
  // Return all legal moves from current state
}

applyMove(state: GameState, move: GameMove): GameState {
  // Return new state after applying move
}

isTerminal(state: GameState): boolean {
  // Check if game is over (win/loss/draw)
}

evaluate(state: GameState): number {
  // Return score: positive = good for us, negative = bad
  // Higher absolute value = stronger position
}
```

### 3. Test Locally (10 min)
```bash
npm run dev
# In another terminal:
curl -X POST http://localhost:3000/move \
  -H "Content-Type: application/json" \
  -d '{"your": "game", "state": "here"}'
```

### 4. Deploy & Verify (10 min)
- Deploy to your public URL
- Test `/healthz` endpoint
- Test `/move` endpoint with sample data
- Monitor logs

## 🎯 Algorithm Quick Selection

| Game Type | Algorithm | Command |
|-----------|-----------|---------|
| Chess-like | Minimax | `AI_STRATEGY=minimax npm start` |
| Complex/Uncertain | MCTS | `AI_STRATEGY=mcts npm start` |
| Simple/Fast | Greedy | `AI_STRATEGY=greedy npm start` |

## 🔧 Common Patterns

### Pattern 1: Board Game (Chess, Checkers, etc.)
```typescript
evaluate(state: GameState): number {
  // Material count
  let score = 0;
  for (piece of state.board) {
    score += piece.value;
  }
  // Position evaluation
  score += evaluatePosition(state.board);
  return score;
}
```

### Pattern 2: Card Game
```typescript
evaluate(state: GameState): number {
  // Hand strength
  const handValue = evaluateHand(state.myHand);
  // Opponent estimation
  const opponentThreat = estimateOpponent(state.opponentActions);
  return handValue - opponentThreat;
}
```

### Pattern 3: Strategy Game
```typescript
evaluate(state: GameState): number {
  // Resource advantage
  const resources = state.myResources - state.opponentResources;
  // Territory control
  const territory = countControlledTerritory(state);
  return resources * 0.6 + territory * 0.4;
}
```

## ⚡ Performance Quick Wins

1. **Early Exit**: If you find a winning move, return immediately
2. **Caching**: Cache evaluated positions (use Map/WeakMap)
3. **Iterative Deepening**: Start depth=2, increase if time allows
4. **Time Check**: Use `TimeManager` to ensure you return in time

## 🐛 Debugging Checklist

- [ ] Log incoming game state
- [ ] Log calculated moves
- [ ] Verify response format matches requirements
- [ ] Check for timeout issues
- [ ] Validate move legality
- [ ] Test edge cases (empty board, end game, etc.)

## 📞 External AI Quick Setup

### OpenAI
```typescript
import { OpenAIGameAI } from './utils/ai-integration';

const ai = new OpenAIGameAI({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4'
});

const move = await ai.suggestMove(gameState, gameRules);
```

### Anthropic
```typescript
import { AnthropicGameAI } from './utils/ai-integration';

const ai = new AnthropicGameAI({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-3-opus-20240229'
});

const move = await ai.suggestMove(gameState, gameRules);
```

## 🎮 Testing Commands

```bash
# Health check
curl http://localhost:3000/healthz

# Move calculation (POST)
curl -X POST http://localhost:3000/move \
  -H "Content-Type: application/json" \
  -d @test-state.json

# Move calculation (GET)
curl "http://localhost:3000/move?param1=value1&param2=value2"
```

## ⏱️ Time Management

```typescript
import { TimeManager } from './utils/time-manager';

const timeManager = new TimeManager(5000); // 5 second limit

// In your search loop:
if (timeManager.shouldStop()) {
  return bestMoveFoundSoFar;
}
```

Good luck! 🚀
