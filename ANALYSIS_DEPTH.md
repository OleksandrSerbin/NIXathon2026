# Analysis Depth Overview

## 📊 Current Analysis Depth

### **Negotiation Phase Analysis**

#### 1. **Game State Analysis** (Multi-layered)
- **Relative Strength Calculation**
  - Player strength: `HP + Armor + (Level × 10)`
  - Enemy strengths: Same for all enemies
  - Strength comparison matrix

- **Threat Identification** (Per enemy)
  - Attack count on us: `combatActions` analysis
  - Threat score: `attack_count × 2 + enemy_strength`
  - Threat classification: High/Medium/Low
  - Recent attack tracking

- **Alliance Value Calculation** (Per enemy)
  ```
  Base value = enemy_strength
  + Not threat bonus: +50
  + Strong ally bonus: +30
  - Attacking us penalty: -attack_count × 20
  - Too weak penalty: -40
  + Previous cooperation: +20
  - Previous betrayal: -50
  ```

- **Betrayal Risk Assessment** (Per enemy)
  ```
  Base risk: 30%
  + Late game: +30%
  + Strong player: +20%
  + Previous betrayal: +40%
  ```

#### 2. **Payoff Calculations** (4 strategies × N enemies)
For each potential ally, calculate payoffs for:
- **Cooperation**: `alliance_value + mutual_threat_bonus + early_game_bonus - late_game_penalty`
- **Defection**: `threat_elimination_value + weak_enemy_bonus - strong_enemy_penalty`
- **Tit-for-Tat**: Based on previous cooperation/defection
- **Betrayal**: `partial_alliance_value + weak_ally_bonus - betrayal_risk_penalty`

#### 3. **Strategy Selection**
- Compare all payoffs across all strategies
- Select highest payoff strategy
- Consider game phase (early/mid/late)
- Apply Nash equilibrium concepts

**Total Calculations**: ~4 strategies × 3 enemies = **12+ payoff calculations per turn**

---

### **Combat Phase Analysis**

#### 1. **Resource Tracking** (Per enemy)
- **Resource Estimation**
  - Track level changes (upgrade detection)
  - Track armor changes (armor build detection)
  - Track attack sizes (spending pattern)
  - Calculate resource generation: `20 × (1.5 ^ (level - 1))`
  - Estimate current resources based on history

- **Spending Pattern Analysis**
  - Average attack size (running average)
  - Upgrade frequency
  - Armor frequency
  - Total spent vs earned ratio

- **Predictions**
  - Can afford upgrade?
  - Expected attack size
  - Likely actions next turn

#### 2. **Target Selection** (Multi-factor scoring)
For each enemy, calculate score:
```
Base Score = HP + Armor

Game Theory Adjustments:
+ If Ally: +200 (avoid)
+ If Betrayer: -100 (prioritize)
+ If Will Attack Us: -40 (preemptive)
+ If High Cooperation: +30 (lower priority)

Resource Adjustments:
+ If Can Upgrade: -50 (threat)
+ If High Resources: -30 (threat)
+ If Low Resources: +20 (easier)
```

**Total Calculations**: ~3 enemies × 6 factors = **18+ score calculations per turn**

#### 3. **Attack Size Optimization**
```
Base: 30 resources

History Adjustments:
+ If Betrayer: up to 45 (retaliation)
+ If Ally: max 15 (minimal)
+ If Will Attack: up to 40 (preemptive)

Resource Adjustments:
+ If Can Upgrade: up to 40 (prevent)
+ If High Resources: up to 35 (counter)
+ If Low Resources: max 20 (efficient)
+ If Low HP: finish off calculation
```

**Total Calculations**: ~5-7 factors per attack = **5-7 calculations per attack**

#### 4. **MCTS Analysis** (If enabled)
- **Iterations**: 500 (default)
- **Tree Search**: UCB1 selection
- **Simulations**: Random game playouts
- **Backpropagation**: Update node statistics
- **Action Combinations**: Generate all valid combinations

**Total Calculations**: 500 iterations × multiple simulations = **1000s of calculations**

---

### **History Tracking** (Persistent across turns)

#### 1. **Game History** (Per enemy)
- Attacks on us count
- Turns since last attack
- Cooperation count
- Defection count

#### 2. **Alliance History** (Per enemy)
- Cooperated: boolean
- Betrayed: boolean
- Alliance turns: number

#### 3. **Resource History** (Per enemy)
- Action history: Array of all actions
- Spending patterns: Aggregated statistics
- Resource estimates: Current and historical

---

## 📈 Analysis Complexity

### **Per Turn Calculations**

| Phase | Calculations | Complexity |
|-------|-------------|------------|
| **Negotiation** | ~15-20 | O(N) where N = enemies |
| **Combat (Heuristic)** | ~25-30 | O(N × M) where N = enemies, M = factors |
| **Combat (MCTS)** | ~1000-5000 | O(I × S) where I = iterations, S = simulations |
| **Combat (Lookahead)** | ~200-1500 | O(A² × T × E) where A = actions, T = turns, E = enemies |

### **Memory Usage**
- **Game History**: ~3 enemies × 4 fields = 12 values
- **Alliance History**: ~3 enemies × 3 fields = 9 values
- **Resource History**: ~3 enemies × 10+ fields = 30+ values
- **Total**: ~50+ tracked values per game

### **Time Complexity**
- **Negotiation**: O(N) - Linear with number of enemies
- **Combat (Heuristic)**: O(N × M) - Linear with enemies and factors
- **Combat (MCTS)**: O(I × S × N) - Iterations × Simulations × Enemies

---

## 🎯 Analysis Depth Levels

### **Level 1: Basic** (Current minimum)
- ✅ Threat identification
- ✅ Basic target selection
- ✅ Resource tracking

### **Level 2: Intermediate** (Current implementation)
- ✅ Game Theory payoffs
- ✅ Alliance value calculation
- ✅ Betrayal risk assessment
- ✅ Resource estimation
- ✅ History-based decisions

### **Level 3: Advanced** (Current with MCTS)
- ✅ MCTS tree search (500 iterations)
- ✅ Probabilistic opponent modeling
- ✅ Multi-turn lookahead (via simulation)
- ✅ Action combination evaluation

### **Level 4: Deep** (Current with Lookahead)
- ✅ Multi-turn planning (2-5 turns ahead)
- ✅ Future state simulation
- ✅ Long-term consequence evaluation
- ✅ Strategic resource planning
- ⏳ Opponent strategy classification
- ⏳ Machine learning predictions
- ⏳ Cross-game learning

---

## 🔍 What We Analyze

### **Current State**
- ✅ Enemy HP, Armor, Level
- ✅ Enemy resources (estimated)
- ✅ Attack patterns
- ✅ Upgrade patterns
- ✅ Alliance relationships
- ✅ Betrayal history
- ✅ Cooperation levels

### **Predictions**
- ✅ Enemy resource estimates
- ✅ Upgrade likelihood
- ✅ Attack likelihood
- ✅ Betrayal risk
- ✅ Cooperation probability

### **Strategic Factors**
- ✅ Threat levels
- ✅ Alliance values
- ✅ Resource efficiency
- ✅ Game phase (early/mid/late)
- ✅ Turn number
- ✅ Fatigue (turn 25+)

---

## 📊 Summary

### **Current Analysis Depth: INTERMEDIATE to ADVANCED**

**Strengths:**
- ✅ Multi-factor decision making
- ✅ History-based learning
- ✅ Resource tracking and prediction
- ✅ Game Theory strategic analysis
- ✅ MCTS for combat (optional)

**Limitations:**
- ⚠️ Lookahead optional (disabled by default for speed)
- ⚠️ No opponent strategy classification
- ⚠️ No cross-game learning
- ⚠️ Limited to current game session

**Performance:**
- ✅ Fast: < 100ms for negotiation
- ✅ Fast: < 1000ms for combat (heuristic)
- ✅ Moderate: 500-800ms for combat (MCTS)

---

## 🚀 Potential Enhancements

1. ✅ **Multi-turn Lookahead**: Implemented (2-5 turns ahead)
2. **Adaptive Lookahead**: More turns for critical decisions
3. **Opponent Modeling**: Classify enemy strategies
4. **Pattern Recognition**: Learn from game patterns
5. **Machine Learning**: Predict opponent actions
6. **Cross-Game Learning**: Persist knowledge across games
7. **Negotiation Lookahead**: Plan future alliances

---

**Current Status**: We perform **comprehensive multi-factor analysis** with **history-based learning**, **resource prediction**, and **multi-turn lookahead planning**, making us competitive at the **advanced to deep** level. 🎯
