/**
 * Simple endpoint tests that can be run manually
 * Run with: ts-node src/tests/simple-test.ts
 * 
 * Make sure server is running first: npm run dev
 */

import axios from 'axios';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration?: number;
}

const results: TestResult[] = [];

async function test(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, message: 'OK', duration });
    console.log(`✅ ${name} (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - start;
    results.push({ name, passed: false, message: error.message, duration });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

async function runTests(): Promise<void> {
  console.log('🧪 Running Endpoint Tests');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');

  // Test 1: Health Check
  await test('GET /healthz', async () => {
    const response = await axios.get(`${BASE_URL}/healthz`, {
      validateStatus: () => true // Accept any status code
    });
    // Health check returns 200 OK if healthy, 503 ERROR if degraded
    // Both are valid responses - endpoint is working
    if (response.status !== 200 && response.status !== 503) {
      throw new Error(`Expected 200 or 503, got ${response.status}`);
    }
    if (!response.data.status || (response.data.status !== 'OK' && response.data.status !== 'ERROR')) {
      throw new Error(`Expected status: OK or ERROR, got ${response.data.status}`);
    }
    // Endpoint is working correctly (returning proper status based on system health)
  });

  // Test 2: Bot Info
  await test('GET /info', async () => {
    const response = await axios.get(`${BASE_URL}/info`);
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
    if (!response.data.name || !response.data.strategy || !response.data.version) {
      throw new Error('Missing required fields in response');
    }
    if (response.data.strategy !== 'AI-trapped-strategy') {
      throw new Error(`Expected strategy: AI-trapped-strategy, got ${response.data.strategy}`);
    }
  });

  // Test 3: Negotiation
  await test('POST /negotiate', async () => {
    const request = {
      gameId: 123,
      turn: 1,
      playerTower: {
        playerId: 101,
        hp: 100,
        armor: 0,
        resources: 20,
        level: 1
      },
      enemyTowers: [
        { playerId: 102, hp: 95, armor: 3, level: 1 },
        { playerId: 103, hp: 80, armor: 10, level: 2 },
        { playerId: 104, hp: 90, armor: 5, level: 1 }
      ],
      combatActions: []
    };

    const start = Date.now();
    const response = await axios.post(`${BASE_URL}/negotiate`, request);
    const duration = Date.now() - start;

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
    if (!Array.isArray(response.data)) {
      throw new Error('Response should be an array');
    }
    if (duration > 1000) {
      throw new Error(`Response too slow: ${duration}ms (should be < 1000ms)`);
    }
  });

  // Test 4: Combat
  await test('POST /combat', async () => {
    const request = {
      gameId: 123,
      turn: 1,
      playerTower: {
        playerId: 101,
        hp: 100,
        armor: 0,
        resources: 20,
        level: 1
      },
      enemyTowers: [
        { playerId: 102, hp: 95, armor: 3, level: 1 },
        { playerId: 103, hp: 80, armor: 10, level: 2 },
        { playerId: 104, hp: 90, armor: 5, level: 1 }
      ],
      diplomacy: [],
      previousAttacks: []
    };

    const start = Date.now();
    const response = await axios.post(`${BASE_URL}/combat`, request);
    const duration = Date.now() - start;

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
    if (!Array.isArray(response.data)) {
      throw new Error('Response should be an array');
    }
    if (duration > 1000) {
      throw new Error(`Response too slow: ${duration}ms (should be < 1000ms)`);
    }

    // Validate action structure
    response.data.forEach((action: any) => {
      if (!action.type) {
        throw new Error('Action missing type');
      }
      if (!['armor', 'attack', 'upgrade'].includes(action.type)) {
        throw new Error(`Invalid action type: ${action.type}`);
      }
    });
  });

  // Test 5: Response Time
  await test('Response Time < 1s', async () => {
    const request = {
      gameId: 123,
      turn: 1,
      playerTower: {
        playerId: 101,
        hp: 100,
        armor: 0,
        resources: 20,
        level: 1
      },
      enemyTowers: [
        { playerId: 102, hp: 95, armor: 3, level: 1 }
      ],
      combatActions: []
    };

    const start = Date.now();
    await axios.post(`${BASE_URL}/negotiate`, request);
    const duration = Date.now() - start;

    if (duration > 1000) {
      throw new Error(`Negotiation too slow: ${duration}ms`);
    }

    const start2 = Date.now();
    await axios.post(`${BASE_URL}/combat`, {
      ...request,
      diplomacy: [],
      previousAttacks: []
    });
    const duration2 = Date.now() - start2;

    if (duration2 > 1000) {
      throw new Error(`Combat too slow: ${duration2}ms`);
    }
  });

  // Summary
  console.log('');
  console.log('====================================');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`Results: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
