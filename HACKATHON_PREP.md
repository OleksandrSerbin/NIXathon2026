# Hackathon Game AI Preparation Guide

## 🎯 Overview
This guide helps you prepare for the hackathon game competition where you'll receive game states via HTTPS and need to return optimal moves.

## 📋 Pre-Competition Checklist

### 1. **Understand the Game Rules** (Day 1 Priority)
- [ ] Read all game documentation carefully
- [ ] Identify game type (turn-based, real-time, perfect/imperfect information)
- [ ] Map out win conditions
- [ ] Understand move constraints and rules
- [ ] Note time limits for move calculation

### 2. **API Structure Setup** ✅
- [x] Health check endpoint (`/healthz`)
- [x] Game move endpoint (`/move`) - POST and GET
- [x] Request/response type definitions
- [x] Error handling

### 3. **AI Strategy Selection**

#### **Minimax Algorithm** (Best for: Perfect information, two-player games)
- ✅ Implemented in `src/game/ai-strategies.ts`
- Use when: Chess, Tic-tac-toe, Connect-4, Checkers
- Pros: Optimal play, guaranteed best move
- Cons: Can be slow for large state spaces

#### **Monte Carlo Tree Search (MCTS)** (Best for: Games with uncertainty)
- ✅ Implemented in `src/game/ai-strategies.ts`
- Use when: Go, complex board games, games with randomness
- Pros: Handles large state spaces, good for imperfect information
- Cons: Requires many iterations for accuracy

#### **Greedy Strategy** (Best for: Fast decisions, simple games)
- ✅ Implemented in `src/game/ai-strategies.ts`
- Use when: Time-constrained, simple evaluation functions
- Pros: Very fast
- Cons: Not optimal, can miss long-term strategies

### 4. **External AI Tools & APIs**

#### **OpenAI GPT-4** (For complex strategy games)
```typescript
// Can analyze game state and suggest moves
// Useful for games requiring strategic thinking
// API: https://platform.openai.com/docs/api-reference
```

#### **Anthropic Claude** (Alternative to GPT)
```typescript
// Good for reasoning about game states
// API: https://docs.anthropic.com/
```

#### **Local ML Models** (For real-time inference)
- TensorFlow.js for browser/Node.js
- ONNX Runtime for pre-trained models
- PyTorch.js for neural networks

### 5. **Optimization Libraries**

#### **Already Added:**
- `lodash` - Utility functions for data manipulation
- `axios` - HTTP client for external API calls

#### **Consider Adding:**
```bash
npm install --save \
  ml-matrix \          # Matrix operations for ML
  simple-statistics \  # Statistical analysis
  priority-queue \     # Priority queues for search algorithms
  immutable \          # Immutable data structures
  @types/immutable
```

### 6. **Testing & Simulation**

Create test scenarios:
```typescript
// src/tests/game-scenarios.ts
// Test various game states
// Simulate opponent moves
// Validate move responses
```

### 7. **Performance Optimization**

- **Caching**: Cache evaluated positions
- **Alpha-Beta Pruning**: Enhance minimax (already in structure)
- **Iterative Deepening**: Start shallow, go deeper if time allows
- **Parallel Processing**: Use worker threads for heavy computation
- **Time Management**: Track time spent, return best move found so far

### 8. **Monitoring & Debugging**

- Log all incoming game states
- Log calculated moves with reasoning
- Track response times
- Monitor confidence scores

## 🚀 Quick Start During Competition

### Step 1: Understand Game Rules
```typescript
// Update src/types/game.ts with actual game structure
export interface GameState {
  board?: any;
  players?: any[];
  currentPlayer?: number;
  // ... actual game fields
}
```

### Step 2: Implement Game Logic
```typescript
// Update src/game/ai-strategies.ts
// Implement:
// - getPossibleMoves()
// - applyMove()
// - isTerminal()
// - evaluate()
```

### Step 3: Test Locally
```bash
npm run dev
# Test with sample game state
curl -X POST http://localhost:3000/move \
  -H "Content-Type: application/json" \
  -d '{"game": "state", "here": true}'
```

### Step 4: Deploy & Monitor
- Deploy to your public URL
- Monitor `/healthz` endpoint
- Test with actual game server
- Adjust strategy based on results

## 🧠 Algorithm Selection Guide

| Game Type | Recommended Algorithm | Why |
|-----------|---------------------|-----|
| Perfect Information, 2-player | Minimax with Alpha-Beta | Optimal play |
| Large State Space | MCTS | Handles complexity |
| Real-time, Fast | Greedy | Speed |
| Imperfect Information | MCTS or ML Model | Handles uncertainty |
| Strategic/Complex | GPT-4 API | Reasoning ability |

## 📚 Useful Resources

### Game AI Algorithms
- [Minimax Algorithm](https://en.wikipedia.org/wiki/Minimax)
- [Alpha-Beta Pruning](https://en.wikipedia.org/wiki/Alpha%E2%80%93beta_pruning)
- [Monte Carlo Tree Search](https://en.wikipedia.org/wiki/Monte_Carlo_tree_search)

### AI APIs
- [OpenAI API](https://platform.openai.com/docs)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [Google Gemini API](https://ai.google.dev/docs)

### Libraries
- [TensorFlow.js](https://www.tensorflow.org/js)
- [ML5.js](https://ml5js.org/) - Friendly ML library
- [Brain.js](https://brain.js.org/) - Neural networks

## ⚡ Performance Tips

1. **Time Management**: Always return a move, even if not optimal
2. **Early Exit**: If you find a winning move, return it immediately
3. **Caching**: Cache position evaluations
4. **Progressive Deepening**: Start with depth 2, increase if time allows
5. **Parallel Search**: Use worker threads for independent branches

## 🐛 Common Pitfalls

1. ❌ Not handling edge cases (empty moves, invalid states)
2. ❌ Timeout issues (taking too long to calculate)
3. ❌ Wrong evaluation function (not aligned with win conditions)
4. ❌ Not testing with actual game server format
5. ❌ Forgetting to handle errors gracefully

## 📝 Competition Day Checklist

- [ ] Server is running and accessible
- [ ] `/healthz` returns 200 OK
- [ ] `/move` endpoint accepts game state
- [ ] Logging is enabled for debugging
- [ ] Strategy is selected and tested
- [ ] Error handling is robust
- [ ] Response format matches requirements
- [ ] Time limits are respected

## 🎮 Example Game State Handling

```typescript
// Example: Tic-tac-toe
interface TicTacToeState {
  board: ('X' | 'O' | null)[][];
  currentPlayer: 'X' | 'O';
}

// Example: Chess
interface ChessState {
  board: Piece[][];
  turn: 'white' | 'black';
  castling: CastlingRights;
  enPassant: Square | null;
}
```

Good luck! 🚀
