# Game Theory Negotiation Guide

## 🎯 Overview

Game Theory-based negotiation strategy for Kingdom Wars. Implements concepts from:
- **Prisoner's Dilemma** - Cooperation vs Defection
- **Tit-for-Tat** - Reciprocal cooperation
- **Nash Equilibrium** - Optimal strategy selection
- **Alliance Formation** - Strategic partnerships
- **Betrayal Detection** - Risk assessment

## 🚀 How It Works

### Default Behavior
Game Theory is **enabled by default** for negotiation phase.

### Disable (use heuristics instead)
```bash
USE_GAME_THEORY=false npm start
```

## 🧠 Game Theory Strategies

### 1. **Cooperate**
- Form alliance with another player
- Work together against mutual threats
- **Best for**: Early game, strong potential allies

**Payoff Factors:**
- Alliance value (strength of partner)
- Mutual threat elimination
- Early game bonus

### 2. **Defect**
- No alliance, attack independently
- Target highest threats
- **Best for**: When no good allies available

**Payoff Factors:**
- Threat elimination value
- Enemy weakness
- Risk assessment

### 3. **Tit-for-Tat**
- Cooperate if they cooperated
- Defect if they defected
- **Best for**: Long-term relationships

**Payoff Factors:**
- Previous cooperation history
- Trust level
- Reciprocal benefits

### 4. **Betray**
- Form alliance but attack them anyway
- Opportunistic strategy
- **Best for**: Weak allies, late game

**Payoff Factors:**
- Ally weakness
- Betrayal risk
- Opportunity value

## 📊 Decision Process

### Step 1: Analyze Game State
- Calculate relative strengths
- Identify threats
- Assess alliance values
- Calculate betrayal risks

### Step 2: Calculate Payoffs
For each potential partner, calculate payoffs for:
- Cooperation
- Defection
- Tit-for-Tat
- Betrayal

### Step 3: Select Strategy
- Choose strategy with highest payoff
- Determine best ally (if cooperating)
- Determine best target

### Step 4: Update History
- Track cooperation/defection
- Update alliance records
- Monitor betrayal patterns

## 🎮 Strategy Selection Logic

### Early Game (Turns 0-10)
- **Prefer**: Cooperation, Tit-for-Tat
- **Reason**: Build alliances, eliminate threats together
- **Avoid**: Betrayal (too early)

### Mid Game (Turns 10-25)
- **Prefer**: Tit-for-Tat, Defection
- **Reason**: Maintain good alliances, eliminate weak players
- **Consider**: Betrayal if ally becomes weak

### Late Game (Turns 25+)
- **Prefer**: Defection, Betrayal
- **Reason**: Last player standing wins
- **Strategy**: Eliminate all opponents

## 📈 Payoff Calculation

### Cooperation Payoff
```
payoff = alliance_value + mutual_threat_bonus + early_game_bonus - late_game_penalty
```

### Defection Payoff
```
payoff = threat_elimination_value + weak_enemy_bonus - strong_enemy_penalty
```

### Tit-for-Tat Payoff
```
if (previous_cooperation):
    payoff = cooperation_payoff + trust_bonus
else:
    payoff = defection_payoff
```

### Betrayal Payoff
```
payoff = partial_alliance_value + weak_ally_bonus - betrayal_risk_penalty
```

## 🔍 Threat Analysis

### Threat Level Calculation
```typescript
threat_score = attack_count × 2 + enemy_strength
```

### Threat Factors
- **Attacks on us**: Higher threat
- **Enemy strength**: HP + armor + (level × 10)
- **Recent attacks**: More weight on recent

## 🤝 Alliance Value

### Alliance Value Calculation
```typescript
value = enemy_strength
+ (not_threat_bonus: +50)
+ (strong_ally_bonus: +30)
- (attacking_us_penalty: -attack_count × 20)
- (too_weak_penalty: -40)
+ (previous_cooperation_bonus: +20)
- (previous_betrayal_penalty: -50)
```

## ⚠️ Betrayal Risk

### Risk Factors
- **Base risk**: 30%
- **Late game**: +30%
- **Strong player**: +20%
- **Previous betrayal**: +40%

### Risk Assessment
- **Low risk** (< 0.5): Safe to ally
- **Medium risk** (0.5-0.7): Caution
- **High risk** (> 0.7): Avoid or betray first

## 📚 Game Theory Concepts

### Prisoner's Dilemma
- **Cooperation**: Both benefit
- **Defection**: One benefits, other loses
- **Mutual defection**: Both lose
- **Best strategy**: Depends on opponent

### Nash Equilibrium
- Strategy where no player can improve by changing
- Optimal given opponent's strategy
- Our algorithm finds Nash-like solutions

### Tit-for-Tat
- Start with cooperation
- Mirror opponent's last move
- Proven effective in iterated games

## 🎯 Example Scenarios

### Scenario 1: Early Game, Strong Ally Available
- **Strategy**: Cooperate
- **Ally**: Strongest non-threat
- **Target**: Mutual threat

### Scenario 2: Mid Game, Previous Ally Betrayed
- **Strategy**: Tit-for-Tat (Defect)
- **Ally**: None
- **Target**: Previous ally (retaliation)

### Scenario 3: Late Game, Weak Ally
- **Strategy**: Betray
- **Ally**: Weak player (temporary)
- **Target**: Same as ally (betrayal)

### Scenario 4: High Threat, No Good Allies
- **Strategy**: Defect
- **Ally**: None
- **Target**: Highest threat

## 🔧 Configuration

### Enable/Disable
```bash
# Enabled by default
USE_GAME_THEORY=true npm start

# Disable (use heuristics)
USE_GAME_THEORY=false npm start
```

## 📊 History Tracking

The algorithm tracks:
- **Attack history**: Who attacked us
- **Cooperation history**: Who cooperated
- **Alliance history**: Alliance duration
- **Betrayal history**: Who betrayed us

This history influences future decisions.

## 🐛 Debugging

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

Logs show:
- Strategy selected
- Payoffs calculated
- Reasoning for decisions
- History updates

## 🎮 Best Practices

1. **Early Game**: Build strong alliances
2. **Mid Game**: Maintain good alliances, eliminate weak players
3. **Late Game**: Betray weak allies, eliminate all
4. **Threat Management**: Always target highest threats
5. **History Matters**: Track cooperation/defection patterns

## 📝 Notes

- Game Theory is **probabilistic** - considers risks
- **Adaptive** - learns from history
- **Strategic** - balances multiple objectives
- **Time-efficient** - fast calculations

Good luck! 🚀
