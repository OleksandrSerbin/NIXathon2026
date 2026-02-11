# Kingdom Wars Strategy Guide

## 🎯 Game Analysis Summary

### Game Type
- **Multiplayer Tower Defense** (4 players)
- **Imperfect Information** (don't know opponent actions)
- **Two Phases**: Negotiation + Combat
- **Objective**: Last tower standing

### Why Minimax is NOT Optimal

❌ **Minimax with Alpha-Beta Pruning is NOT suitable because:**
1. **4 players** (Minimax is for 2-player games)
2. **Imperfect information** (don't know what others will do)
3. **Negotiation phase** (alliances, game theory)
4. **Multi-objective** (survival, resources, positioning)

### Similar Games
- **Risk** - Multiplayer strategy with alliances
- **Diplomacy** - Negotiation and betrayal mechanics
- **Tower Defense** - Resource management and upgrades
- **Survival Games** - Last player standing

## 🧠 Recommended Algorithms

### 1. **Heuristic-Based Strategy** ⭐ CURRENT IMPLEMENTATION
**Why it's good:**
- ✅ **Fast** (meets 1-second requirement)
- ✅ **Simple to implement**
- ✅ **Good for real-time decisions**
- ✅ **Can encode domain knowledge**

**Best for:**
- Quick implementation
- Reliable performance
- Meeting time constraints

### 2. **MCTS (Monte Carlo Tree Search)** ⭐ RECOMMENDED FOR ENHANCEMENT
**Why it's good:**
- Handles **uncertainty** (simulates opponent actions)
- Works for **multiplayer** games
- Can model **probabilistic outcomes**
- Good for **combat phase** decision making

**Best for:**
- Combat phase optimization
- Evaluating action combinations
- Handling uncertainty

### 3. **Game Theory Approaches**
**Why it's good:**
- Handles **negotiation/diplomacy**
- Models **alliance formation**
- Nash equilibrium concepts

**Best for:**
- Negotiation phase
- Alliance decisions
- Betrayal timing

## 📊 Current Implementation

### Negotiation Strategy (Heuristic)
1. **Analyze Threats**
   - Count attacks on us
   - Evaluate enemy strength
   - Identify major threats

2. **Find Best Ally**
   - Strongest non-threat enemy
   - Low threat to us
   - High HP/level

3. **Find Best Target**
   - Weakest high-threat enemy
   - Low HP + armor
   - High threat level

### Combat Strategy (Heuristic)
1. **Upgrade Decision**
   - Upgrade if: HP > 50, (turn < 20 OR behind in level)
   - Cost: 50 × (1.75 ^ (level - 1))

2. **Armor Decision**
   - Build armor if: (HP < 60 OR turn >= 25) AND armor < 10
   - Cost: amount × 1 resource

3. **Attack Decision**
   - Attack weakest enemy (lowest HP + armor)
   - Use remaining resources
   - Cost: troopCount × 1 resource

## 🚀 Enhancement Opportunities

### Phase 1: Improve Heuristics (Quick Win)
- [ ] Better threat analysis
- [ ] Dynamic resource thresholds
- [ ] Fatigue-aware decisions (turn 25+)
- [ ] Alliance betrayal logic

### Phase 2: Add MCTS for Combat (If Time)
- [ ] Implement MCTS for combat phase
- [ ] Simulate different action combinations
- [ ] Model opponent behavior probabilistically

### Phase 3: Game Theory for Negotiation (Advanced)
- [ ] Model alliance payoffs
- [ ] Predict betrayal likelihood
- [ ] Optimize negotiation decisions

## 📈 Resource Management Strategy

### Early Game (Turns 1-10)
- **Priority**: Upgrade > Armor > Attack
- **Goal**: Level up quickly
- **Diplomacy**: Form alliances

### Mid Game (Turns 11-24)
- **Priority**: Attack > Upgrade > Armor
- **Goal**: Eliminate weakest players
- **Diplomacy**: Betray weak allies if beneficial

### Late Game (Turns 25+)
- **Priority**: Armor > Attack > Upgrade
- **Goal**: Survival (fatigue damage)
- **Diplomacy**: Last player standing wins

## 🎯 Key Metrics to Track

1. **Threat Level** - How dangerous each enemy is
2. **Resource Efficiency** - Resources per turn
3. **HP/Armor Ratio** - Defense capability
4. **Level Advantage** - Resource generation
5. **Fatigue Damage** - Turn 25+ escalation

## 🔧 Implementation Checklist

### ✅ Completed
- [x] Game type definitions
- [x] Negotiation endpoint handler
- [x] Combat endpoint handler
- [x] Bot info endpoint
- [x] Required logging (`[KW-BOT] Mega ogudor`)
- [x] Basic heuristic strategy

### 🚧 To Enhance
- [ ] Improve threat analysis
- [ ] Better resource allocation
- [ ] Alliance management
- [ ] Fatigue-aware decisions
- [ ] MCTS for combat (optional)
- [ ] Game theory for negotiation (optional)

## 💡 Quick Wins

1. **Better Threat Analysis**
   ```typescript
   // Weight recent attacks more heavily
   // Consider enemy level and resources
   // Factor in diplomacy history
   ```

2. **Dynamic Thresholds**
   ```typescript
   // Adjust HP thresholds based on turn
   // Adapt to game phase
   // Consider fatigue damage
   ```

3. **Alliance Betrayal**
   ```typescript
   // Betray if ally becomes weak
   // Switch sides if beneficial
   // Time betrayal for maximum impact
   ```

## 🐛 Testing

Test with sample requests:

```bash
# Negotiation
curl -X POST http://localhost:3000/negotiate \
  -H "Content-Type: application/json" \
  -d @test-negotiate.json

# Combat
curl -X POST http://localhost:3000/combat \
  -H "Content-Type: application/json" \
  -d @test-combat.json

# Info
curl http://localhost:3000/info
```

## 📚 Algorithm Comparison

| Algorithm | Negotiation | Combat | Speed | Implementation |
|-----------|-------------|--------|-------|---------------|
| **Heuristics** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Current |
| **MCTS** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 🚧 Optional |
| **Game Theory** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | 🚧 Advanced |

## 🎮 Strategy Tips

1. **Early Game**: Focus on leveling up
2. **Mid Game**: Eliminate weak players
3. **Late Game**: Maximize survival
4. **Negotiation**: Form temporary alliances
5. **Combat**: Balance offense and defense
6. **Resources**: Save for critical moments

Good luck! 🚀
