# Multi-Turn Lookahead Planning Guide

## 🎯 Overview

Multi-turn lookahead planning simulates future game states to make better strategic decisions. Instead of just considering the immediate turn, we evaluate how actions will affect the game 2-5 turns ahead.

## 🚀 How to Enable

### Environment Variable
```bash
USE_LOOKAHEAD=true npm start
```

### Configuration Options
```bash
# Number of turns to look ahead (default: 3)
LOOKAHEAD_TURNS=3

# Example: Look 5 turns ahead
USE_LOOKAHEAD=true LOOKAHEAD_TURNS=5 npm start
```

## 🧠 How It Works

### 1. **Action Generation**
- Generates all possible action combinations
- Single actions: upgrade, armor, attack
- Combined actions: upgrade + attack, armor + attack, etc.
- Respects resource constraints

### 2. **Simulation**
For each action sequence:
- **Apply our actions** to current state
- **Simulate N turns forward**:
  - Resource regeneration each turn
  - Opponent actions (probabilistic)
  - Fatigue damage (turn 25+)
  - State evaluation

### 3. **Evaluation**
Each simulated future state is scored:
```
score = 
  hp × 10 +
  armor × 5 +
  level × 50 +
  resources × 2 -
  (sum of enemy strengths) +
  (eliminated enemies × 100) -
  (death penalty: -10000)
```

### 4. **Selection**
- Choose action sequence with highest future score
- Considers long-term consequences
- Balances immediate vs future benefits

## 📊 Lookahead Process

### Turn-by-Turn Simulation

**Turn 0 (Current):**
- Apply our actions
- Update game state

**Turn 1:**
- Regenerate resources
- Simulate opponent actions
- Apply fatigue (if turn 25+)
- Evaluate state

**Turn 2:**
- Regenerate resources
- Simulate opponent actions
- Apply fatigue
- Evaluate state

**Turn N:**
- Continue until max turns
- Final evaluation

### Opponent Simulation

For each enemy, probabilistically simulate:
- **Upgrade** (30% chance if can afford)
- **Armor** (40% chance)
- **Attack on us** (50% chance)
- Uses resource estimates for realistic behavior

## 🎮 Strategic Benefits

### 1. **Long-term Planning**
- Considers future consequences
- Avoids short-sighted decisions
- Plans for late game

### 2. **Resource Management**
- Saves resources for future upgrades
- Plans resource accumulation
- Optimizes spending over time

### 3. **Threat Assessment**
- Sees future threats coming
- Plans defensive actions early
- Prepares for enemy upgrades

### 4. **Fatigue Planning**
- Prepares for turn 25+ fatigue
- Builds armor before fatigue starts
- Plans survival strategy

## ⚙️ Configuration

### Recommended Settings

**Fast (meets 1-second requirement):**
```bash
USE_LOOKAHEAD=true
LOOKAHEAD_TURNS=2
```

**Balanced (good planning):**
```bash
USE_LOOKAHEAD=true
LOOKAHEAD_TURNS=3
```

**Thorough (best planning, slower):**
```bash
USE_LOOKAHEAD=true
LOOKAHEAD_TURNS=5
```

## 📈 Performance

### Time Complexity
- **Action combinations**: O(A²) where A = possible actions
- **Simulation**: O(T × E) where T = turns, E = enemies
- **Total**: O(A² × T × E)

### Typical Performance
- 2 turns: ~200-400ms
- 3 turns: ~400-700ms
- 5 turns: ~800-1500ms

### Memory
- Stores simulated states
- Typically < 5MB for 3 turns
- Grows with lookahead depth

## 🎯 When to Use Lookahead

### ✅ Good For:
- **Combat phase** strategic planning
- **Resource management** decisions
- **Upgrade timing** optimization
- **Late game** preparation
- **Complex decisions** with long-term impact

### ❌ Not Needed For:
- **Simple decisions** (heuristics faster)
- **Time-constrained** situations (< 200ms)
- **Early game** (less critical)
- **When MCTS is enabled** (MCTS already does lookahead)

## 🔧 How It Integrates

### Decision Priority:
1. **MCTS** (if enabled) - Already does lookahead
2. **Lookahead Planner** (if enabled) - Multi-turn simulation
3. **Heuristic** (default) - Fast, rule-based

### With Other Systems:
- **Resource Tracker**: Uses estimates for opponent simulation
- **Game Theory**: Can be combined (future enhancement)
- **MCTS**: Alternative approach (choose one)

## 📊 Example Scenario

### Scenario: Should I upgrade or attack?

**Without Lookahead:**
- Attack now: Immediate damage
- Upgrade: Future benefit
- Decision: Attack (immediate benefit)

**With Lookahead (3 turns):**
- **Attack now**: 
  - Turn 0: Deal 20 damage
  - Turn 1: Enemy attacks back, we're weak
  - Turn 2: Still weak, enemy recovers
  - Score: 500

- **Upgrade now**:
  - Turn 0: No damage, but level up
  - Turn 1: More resources, can attack harder
  - Turn 2: Stronger, better position
  - Score: 800

**Decision**: Upgrade (better long-term)

## 🐛 Debugging

Enable debug logging:
```bash
LOG_LEVEL=debug USE_LOOKAHEAD=true npm start
```

Logs will show:
- Action combinations evaluated
- Best score found
- Simulated future states
- Performance metrics

## 🎮 Best Practices

1. **Start with 2-3 turns** - Good balance
2. **Increase for late game** - More critical decisions
3. **Monitor performance** - Ensure < 1 second
4. **Combine with resource tracking** - Better opponent simulation
5. **Use for complex decisions** - Simple ones don't need it

## 📝 Notes

- Lookahead is **probabilistic** - results may vary
- More turns = better planning (but slower)
- Opponent simulation uses resource estimates
- Falls back to heuristics if disabled or fails
- Can be combined with MCTS (future enhancement)

## 🚀 Future Enhancements

Potential improvements:
- **Adaptive depth**: More turns for critical decisions
- **Selective lookahead**: Only for important decisions
- **Opponent modeling**: Better simulation accuracy
- **Negotiation lookahead**: Plan future alliances
- **Parallel evaluation**: Faster processing

Good luck! 🚀
