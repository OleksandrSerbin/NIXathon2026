# Monte Carlo Tree Search (MCTS) Guide

## 🎯 Overview

MCTS has been implemented for Kingdom Wars combat phase. It handles uncertainty about opponent actions and evaluates different action combinations probabilistically.

## 🚀 How to Enable

### Environment Variable
```bash
USE_MCTS=true npm start
```

### Configuration Options
```bash
# Number of MCTS iterations (default: 500)
MCTS_ITERATIONS=500

# Time limit in milliseconds (default: 800ms)
MCTS_TIME_LIMIT_MS=800

# Exploration constant (default: 1.41, sqrt(2))
# Higher = more exploration, Lower = more exploitation
```

## 📊 How MCTS Works

### 1. **Selection**
- Traverses tree using UCB1 (Upper Confidence Bound)
- Balances exploration vs exploitation
- Chooses path to leaf node

### 2. **Expansion**
- Adds new child node with untried action sequence
- Explores new possibilities

### 3. **Simulation**
- Plays random game to completion
- Simulates opponent actions probabilistically
- Evaluates final game state

### 4. **Backpropagation**
- Updates node statistics (visits, wins)
- Propagates results up the tree
- Improves future selections

## 🎮 What MCTS Does

### For Combat Phase:
1. **Generates Action Combinations**
   - All valid upgrade/armor/attack combinations
   - Respects resource constraints
   - Ensures valid action sequences

2. **Simulates Opponent Behavior**
   - Models opponent actions probabilistically
   - 30% chance to upgrade
   - 40% chance to build armor
   - 50% chance to attack

3. **Evaluates Outcomes**
   - Scores game states (HP, armor, level, resources)
   - Penalizes enemy strength
   - Rewards eliminating enemies
   - Heavy penalty for death

4. **Selects Best Actions**
   - Returns most visited (best performing) action sequence
   - Balances multiple objectives
   - Handles uncertainty

## ⚙️ Configuration

### Recommended Settings

**Fast (meets 1-second requirement):**
```bash
USE_MCTS=true
MCTS_ITERATIONS=300
MCTS_TIME_LIMIT_MS=500
```

**Balanced (good performance):**
```bash
USE_MCTS=true
MCTS_ITERATIONS=500
MCTS_TIME_LIMIT_MS=800
```

**Thorough (best decisions, slower):**
```bash
USE_MCTS=true
MCTS_ITERATIONS=1000
MCTS_TIME_LIMIT_MS=1500
```

## 📈 Performance

### Time Complexity
- **Iterations**: O(n) where n = iterations
- **Per iteration**: O(m) where m = action combinations
- **Total**: O(n × m)

### Typical Performance
- 300 iterations: ~300-500ms
- 500 iterations: ~500-800ms
- 1000 iterations: ~1000-1500ms

### Memory
- Grows with tree depth
- Typically < 10MB for 500 iterations
- Automatically pruned after selection

## 🎯 When to Use MCTS

### ✅ Good For:
- **Combat phase** decision making
- **Uncertainty** about opponent actions
- **Complex** action combinations
- **Multi-objective** optimization
- **Late game** critical decisions

### ❌ Not Needed For:
- **Negotiation phase** (use heuristics/game theory)
- **Simple decisions** (heuristics faster)
- **Time-constrained** situations (< 200ms)

## 🔧 How It Integrates

### Default Behavior
- **Heuristic strategy** (fast, reliable)
- No MCTS by default

### With MCTS Enabled
- **Combat phase**: Uses MCTS
- **Negotiation phase**: Still uses heuristics
- **Fallback**: If MCTS fails, uses heuristics

## 📊 Evaluation Function

MCTS evaluates states using:
```typescript
score = 
  hp × 10 +
  armor × 5 +
  level × 50 +
  resources × 2 -
  (sum of enemy strengths) +
  (eliminated enemies × 100) -
  (death penalty: -10000)
```

## 🐛 Debugging

Enable debug logging to see MCTS details:
```bash
LOG_LEVEL=debug USE_MCTS=true npm start
```

Logs will show:
- Iterations run
- Total nodes created
- Best action selected
- Performance metrics

## 🎮 Example Usage

```bash
# Enable MCTS with default settings
USE_MCTS=true npm start

# Custom configuration
USE_MCTS=true MCTS_ITERATIONS=1000 MCTS_TIME_LIMIT_MS=1200 npm start
```

## 📚 Algorithm Details

### UCB1 Formula
```
UCB1 = (wins / visits) + C × sqrt(ln(parent_visits) / visits)
```
Where C = exploration constant (default: 1.41)

### Selection Strategy
- Always explore unvisited nodes first
- Use UCB1 for visited nodes
- Balance exploration vs exploitation

### Simulation Strategy
- Random opponent actions
- Probabilistic modeling
- Fast evaluation

## 🚀 Performance Tips

1. **Adjust iterations** based on time available
2. **Lower exploration** (1.0) for more exploitation
3. **Higher exploration** (2.0) for more exploration
4. **Time limit** ensures response within 1 second
5. **Monitor logs** to see actual performance

## 📝 Notes

- MCTS is **probabilistic** - results may vary slightly
- More iterations = better decisions (but slower)
- Time limit ensures we always return in time
- Falls back to heuristics if MCTS fails

Good luck! 🚀
