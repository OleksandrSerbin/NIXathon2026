# Minimax with Alpha-Beta Pruning Strategy

## 🎯 Overview

The `MinimaxStrategy` class now includes **Alpha-Beta Pruning** - the optimal algorithm for perfect-information, two-player games like Connect Four and similar games.

## ✨ Key Features

### 1. **Alpha-Beta Pruning**
- **50-90% faster** than regular minimax
- Prunes branches that won't affect the final decision
- Allows searching 2-3x deeper in the same time

### 2. **Transposition Table**
- Caches evaluated positions
- Avoids re-evaluating same board states
- Significant performance boost

### 3. **Iterative Deepening**
- Starts with depth 2, increases gradually
- Always has a valid move ready if time runs out
- Gets progressively better moves as time allows

### 4. **Time Management**
- Respects time limits via `TimeManager`
- Returns best move found so far if timeout
- Prevents API timeouts

### 5. **Immediate Win Detection**
- Checks for winning moves first
- Returns instantly if win is found
- No unnecessary searching

## 🚀 Usage

### Default (Recommended)
```bash
npm start
# Uses: Depth 8, Time limit 5s, Iterative deepening enabled
```

### Custom Configuration
```bash
# Set depth
MINIMAX_DEPTH=10 npm start

# Set time limit (milliseconds)
MOVE_TIME_LIMIT_MS=3000 npm start

# Both
MINIMAX_DEPTH=8 MOVE_TIME_LIMIT_MS=5000 npm start
```

### Programmatic
```typescript
import { MinimaxStrategy } from './game/ai-strategies';

const strategy = new MinimaxStrategy(
  8,        // maxDepth
  true,     // isMaximizing
  5000,     // timeLimitMs (optional)
  true      // useIterativeDeepening (optional, default: true)
);
```

## 📊 Performance

| Depth | Time (approx) | Strength | Use Case |
|-------|---------------|----------|----------|
| 4-5   | < 1s          | Good     | Fast games, simple positions |
| 6-8   | 2-5s          | Strong   | **Recommended for most games** |
| 10+   | 5-15s         | Very Strong | When time allows |

## 🔧 Implementation Checklist

When game rules are revealed, implement these methods in `MinimaxStrategy`:

### Required Methods

1. **`getPossibleMoves(state)`** - Return all legal moves
   ```typescript
   private getPossibleMoves(state: GameState): GameMove[] {
     // Return array of valid moves
   }
   ```

2. **`applyMove(state, move)`** - Apply move and return new state
   ```typescript
   private applyMove(state: GameState, move: GameMove): GameState {
     // Return new game state after move
   }
   ```

3. **`isTerminal(state)`** - Check if game is over
   ```typescript
   private isTerminal(state: GameState): boolean {
     // Return true if win/loss/draw
   }
   ```

4. **`evaluate(state)`** - Score the position
   ```typescript
   evaluate(state: GameState): number {
     // Return positive for good positions, negative for bad
     // Higher absolute value = stronger position
   }
   ```

### Optional Optimizations

5. **`isWinningMove(state)`** - Check for immediate wins
   ```typescript
   protected isWinningMove(state: GameState): boolean {
     // Return true if current player has won
   }
   ```

## 💡 Evaluation Function Tips

For Connect Four-like games, prioritize:

1. **Wins/Losses** (10000 points)
   - Highest priority - game over states

2. **Threats** (100-150 points each)
   - N-1 in a row with open ends
   - Opponent threats weighted higher

3. **Position Control** (10-50 points)
   - Center control (for Connect Four)
   - Key squares/positions

4. **Mobility** (5-10 points)
   - Number of available moves
   - More options = better

## 🎮 Example: Connect Four Evaluation

```typescript
evaluate(state: GameState): number {
  // Check for wins
  if (this.isWinningMove(state)) {
    return this.isMaximizing ? 10000 : -10000;
  }
  
  // Count threats (3 in a row with open ends)
  const myThreats = this.countThreats(state, this.myPlayer);
  const opponentThreats = this.countThreats(state, this.opponentPlayer);
  
  // Center control
  const centerControl = this.evaluateCenterControl(state);
  
  return (
    myThreats * 100 -
    opponentThreats * 150 +  // Opponent threats more dangerous
    centerControl * 10
  );
}
```

## ⚡ Performance Optimizations

### 1. Move Ordering
Order moves by quality before searching:
- Winning moves first
- Center moves before edges
- Threatening moves before defensive

### 2. Transposition Table
Already implemented - automatically caches positions

### 3. Early Exit
Already implemented - returns immediately on wins

### 4. Time Management
Already implemented - respects time limits

## 🐛 Debugging

Enable detailed logging:
```bash
ENABLE_LOGGING=true npm start
```

Check move calculation time:
- Logs show: `Move calculated in Xms with confidence Y%`
- If too slow, reduce depth or time limit

## 📈 Why Alpha-Beta is Better

**Regular Minimax:**
- Searches all branches
- Slow for deep searches
- Can timeout on complex positions

**Alpha-Beta Pruning:**
- Prunes irrelevant branches
- 50-90% faster
- Can search 2-3x deeper
- Same optimal results

## 🎯 Best Practices

1. **Start with depth 6-8** - Good balance
2. **Use iterative deepening** - Better time management
3. **Implement immediate win detection** - Instant wins
4. **Order moves intelligently** - Better pruning
5. **Test with time limits** - Ensure no timeouts

## 📚 Algorithm Details

### Alpha-Beta Pruning
```
If we know a move leads to a score worse than what we've already found,
we can skip evaluating the rest of that branch.
```

### Iterative Deepening
```
Search depth 2 → get best move
Search depth 3 → get better move
Search depth 4 → get even better move
...
If time runs out, return best move found so far
```

Ready to compete! 🚀
