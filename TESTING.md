# Testing Guide

## 🧪 Test Suite

### Simple Tests (No Dependencies Required) ⭐ RECOMMENDED

Quick test script using axios (already installed):
```bash
# Make sure server is running first
npm run dev

# In another terminal, run simple tests
npm run test:simple

# Or test against different URL
TEST_URL=http://your-server:8080 npm run test:simple
```

### Jest Tests (Full Test Suite)

Install dependencies first:
```bash
npm install
```

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

### Manual Testing Script (Bash)

Quick manual tests using curl:
```bash
# Make sure server is running first
npm run dev

# In another terminal, run tests
./test-endpoints.sh

# Or test against different URL
BASE_URL=http://your-server:8080 ./test-endpoints.sh
```

## 📋 Test Coverage

### Endpoint Tests

#### ✅ GET /healthz
- Returns 200 OK with `{ "status": "OK" }`
- Responds quickly (< 100ms)
- Handles system health checks

#### ✅ GET /info
- Returns bot metadata
- Includes required `strategy: "AI-trapped-strategy"`
- Includes name and version

#### ✅ POST /negotiate
- Accepts negotiation request
- Returns array of negotiation responses
- Handles multiple enemy towers
- Validates request structure
- Responds within 1 second

#### ✅ POST /combat
- Accepts combat request
- Returns array of combat actions
- Validates action structure (type, amount, targetId, troopCount)
- Handles different scenarios:
  - Low resources
  - Upgrade scenarios
  - Late game (fatigue)
- Responds within 1 second

### Integration Tests

- Full game flow (negotiation → combat)
- Multiple consecutive requests
- Large requests (many enemies)
- Error handling (malformed JSON, empty body)

## 🎯 Test Scenarios

### Scenario 1: Early Game
```json
{
  "turn": 5,
  "playerTower": { "hp": 100, "resources": 20, "level": 1 }
}
```

### Scenario 2: Late Game (Fatigue)
```json
{
  "turn": 30,
  "playerTower": { "hp": 50, "armor": 5, "level": 2 }
}
```

### Scenario 3: Under Attack
```json
{
  "combatActions": [
    { "playerId": 102, "action": { "targetId": 101, "troopCount": 15 } }
  ]
}
```

### Scenario 4: Low Resources
```json
{
  "playerTower": { "resources": 5 }
}
```

## 🚀 Running Tests

### Quick Test (Manual)
```bash
# Start server
npm run dev

# Run manual tests
./test-endpoints.sh
```

### Full Test Suite (Jest)
```bash
npm test
```

### Test Specific Endpoint
```bash
# Test health check
curl http://localhost:3000/healthz

# Test negotiation
curl -X POST http://localhost:3000/negotiate \
  -H "Content-Type: application/json" \
  -d @test-negotiate.json

# Test combat
curl -X POST http://localhost:3000/combat \
  -H "Content-Type: application/json" \
  -d @test-combat.json
```

## 📝 Test Files

- `src/tests/endpoints.test.ts` - Jest test suite
- `src/tests/test-utils.ts` - Test utilities
- `test-endpoints.sh` - Manual test script

## ✅ Expected Results

All tests should:
- ✅ Return 200 OK for valid requests
- ✅ Return 400 for invalid requests
- ✅ Respond within 1 second
- ✅ Return correct data structures
- ✅ Handle edge cases gracefully

## 🐛 Debugging Failed Tests

1. Check server is running
2. Check logs for errors
3. Verify request format matches game rules
4. Check response structure
5. Verify timing (should be < 1000ms)

## 📊 Test Results

After running tests, you should see:
- All endpoints responding correctly
- Response times under 1 second
- Valid JSON responses
- Proper error handling

Good luck! 🚀
