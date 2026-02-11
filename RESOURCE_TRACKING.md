# Enemy Resource Tracking & Planning

## 🎯 Overview

We now track enemy resource allocation and spending patterns to make better strategic decisions. This allows us to:

- **Estimate enemy resources** based on their level and actions
- **Predict enemy actions** (upgrades, attacks, armor)
- **Plan our moves** to counter enemy strategies
- **Prioritize targets** based on resource threat

## 📊 How It Works

### Resource Estimation

#### 1. **Resource Generation Tracking**
- Formula: `20 × (1.5 ^ (level - 1))`
- Level 1: 20 resources/turn
- Level 2: 30 resources/turn
- Level 3: 45 resources/turn
- Level 4: 68 resources/turn
- Level 5: 101 resources/turn

#### 2. **Spending Pattern Detection**
We track:
- **Upgrades**: Detect level changes, calculate cost
- **Armor**: Detect armor increases, calculate cost
- **Attacks**: Track attack sizes from `combatActions` and `previousAttacks`
- **Average attack size**: Running average of enemy attack patterns

#### 3. **Resource Estimation Algorithm**
```typescript
estimatedResources = 
  resourceGeneration (per turn) 
  - averageSpending 
  + lastKnownActionCost
```

### What We Track

For each enemy, we maintain:

```typescript
{
  playerId: number;
  estimatedResources: number;        // Current estimated resources
  resourceGeneration: number;        // Resources per turn
  lastKnownLevel: number;            // For upgrade detection
  lastKnownHP: number;                // For state tracking
  lastKnownArmor: number;            // For armor detection
  spendingPattern: {
    avgAttackSize: number;           // Average attack size
    upgradeFrequency: number;        // How often they upgrade
    armorFrequency: number;          // How often they build armor
    totalSpent: number;              // Total resources spent
    totalEarned: number;             // Total resources earned
  };
  actionHistory: Array<{             // Detailed action log
    turn: number;
    action: 'attack' | 'upgrade' | 'armor' | 'none';
    cost: number;
    level?: number;
  }>;
}
```

## 🎮 Strategic Uses

### 1. **Target Prioritization**

#### High Priority Targets:
- **Can afford upgrade**: Attack before they upgrade (higher threat)
- **High resources**: Can make big attacks (dangerous)
- **Low HP + low resources**: Easy to finish off

#### Low Priority Targets:
- **Low resources**: Less immediate threat
- **Just upgraded**: Spent resources, less dangerous now

### 2. **Attack Size Planning**

```typescript
if (enemy.canAffordUpgrade) {
  attackSize = larger; // Prevent upgrade
}
if (enemy.estimatedResources > generation * 2) {
  attackSize = larger; // Counter big attack threat
}
if (enemy.hp < 30) {
  attackSize = hp + armor + 5; // Finish them off
}
```

### 3. **Upgrade Prediction**

We can predict if enemy will upgrade:
- Check if `estimatedResources >= upgradeCost`
- Consider their upgrade frequency pattern
- Early game: More likely to upgrade

### 4. **Resource-Based Negotiation**

Use resource estimates in Game Theory:
- **Strong enemies** (high resources): Better allies or bigger threats
- **Weak enemies** (low resources): Easier targets
- **Upgrade-ready enemies**: High priority to attack

## 📈 Example Scenarios

### Scenario 1: Enemy Can Upgrade
```
Enemy Level 1 → 2 (cost: 50)
Estimated Resources: 60
→ Priority: HIGH (attack before upgrade)
→ Attack Size: Larger (40 instead of 30)
```

### Scenario 2: Enemy Low Resources
```
Enemy Resources: 5 (generation: 20)
→ Priority: LOW (less threat)
→ Attack Size: Smaller (20 instead of 30)
→ Focus on other threats
```

### Scenario 3: Enemy High Resources
```
Enemy Resources: 50 (generation: 20)
→ Priority: HIGH (can make big attack)
→ Attack Size: Larger (35 instead of 30)
→ Defensive: Build armor if low HP
```

## 🔧 Implementation Details

### Integration Points

1. **Negotiation Phase** (`POST /negotiate`):
   - Update resource estimates
   - Use estimates in Game Theory calculations
   - Log estimates for debugging

2. **Combat Phase** (`POST /combat`):
   - Update resource estimates from `previousAttacks`
   - Use estimates for target selection
   - Use estimates for attack size calculation

### Detection Methods

#### Upgrade Detection:
```typescript
if (enemy.level > lastKnownLevel) {
  cost = getUpgradeCost(lastKnownLevel);
  // Track upgrade
}
```

#### Armor Detection:
```typescript
if (enemy.armor > lastKnownArmor) {
  cost = enemy.armor - lastKnownArmor;
  // Track armor build
}
```

#### Attack Detection:
```typescript
combatActions.forEach(action => {
  if (action.action?.troopCount) {
    cost = action.action.troopCount;
    // Track attack
  }
});
```

## 📊 Logging

Resource estimates are logged at DEBUG level:

```json
{
  "playerId": 102,
  "estimatedResources": 25,
  "resourceGeneration": 20,
  "level": 1,
  "canUpgrade": false,
  "expectedAttackSize": 15
}
```

## 🎯 Benefits

1. **Better Target Selection**: Prioritize threats based on resources
2. **Optimal Attack Sizing**: Adjust attack size based on enemy state
3. **Upgrade Prevention**: Attack enemies before they upgrade
4. **Resource Efficiency**: Don't over-attack weak enemies
5. **Strategic Planning**: Make informed decisions based on enemy capabilities

## 🚀 Future Enhancements

Potential improvements:
- **Predictive modeling**: ML-based resource prediction
- **Pattern recognition**: Identify enemy strategies (aggressive, defensive, etc.)
- **Multi-game learning**: Track patterns across multiple games
- **Resource confidence**: Confidence intervals for estimates

## 📝 Notes

- Estimates are **per game session** (reset on server restart)
- Estimates improve over time as we see more actions
- Conservative estimates (assume enemies spend most resources)
- Works best with consistent enemy behavior patterns

Good luck! 🚀
