import request from 'supertest';
import express from 'express';
import { KingdomWarsHandler } from '../game/kingdom-wars-handler';
import { MoveHandler } from '../game/move-handler';
import os from 'os';

// Create test app (similar to server.ts but for testing)
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const kingdomWarsHandler = new KingdomWarsHandler({
    name: 'Test Bot',
    version: '1.0'
  }, false); // Disable MCTS for faster tests

  const moveHandler = new MoveHandler('greedy');

  // Kingdom Wars endpoints
  app.post('/negotiate', async (req, res) => {
    await kingdomWarsHandler.handleNegotiate(req, res);
  });

  app.post('/combat', async (req, res) => {
    await kingdomWarsHandler.handleCombat(req, res);
  });

  app.get('/info', (req, res) => {
    kingdomWarsHandler.getBotInfo(req, res);
  });

  // Legacy endpoints
  app.post('/move', async (req, res) => {
    await moveHandler.handleMove(req, res);
  });

  app.get('/move', async (req, res) => {
    await moveHandler.handleMove(req, res);
  });

  // Health check
  app.get('/healthz', (req, res) => {
    try {
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;
      const isHealthy = memoryUsagePercent < 90 && process.uptime() > 0;
      
      if (isHealthy) {
        res.status(200).json({ status: 'OK' });
      } else {
        res.status(503).json({ status: 'ERROR' });
      }
    } catch (error) {
      res.status(503).json({ status: 'ERROR' });
    }
  });

  return app;
};

describe('API Endpoints Tests', () => {
  const app = createTestApp();

  describe('GET /healthz', () => {
    it('should return 200 OK with status', async () => {
      const response = await request(app)
        .get('/healthz')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('OK');
    });

    it('should respond quickly', async () => {
      const start = Date.now();
      await request(app).get('/healthz');
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should be fast
    });
  });

  describe('GET /info', () => {
    it('should return bot metadata', async () => {
      const response = await request(app)
        .get('/info')
        .expect(200);

      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('strategy');
      expect(response.body).toHaveProperty('version');
      expect(response.body.strategy).toBe('AI-trapped-strategy');
    });
  });

  describe('POST /negotiate', () => {
    const sampleNegotiateRequest = {
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

    it('should return 200 OK with negotiation response', async () => {
      const response = await request(app)
        .post('/negotiate')
        .send(sampleNegotiateRequest)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Response should be array (empty or with negotiation objects)
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('allyId');
        // attackTargetId is optional
      }
    });

    it('should respond within 1 second', async () => {
      const start = Date.now();
      await request(app)
        .post('/negotiate')
        .send(sampleNegotiateRequest);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
    });

    it('should handle missing fields gracefully', async () => {
      const invalidRequest = {
        gameId: 123,
        turn: 1
        // Missing required fields
      };

      const response = await request(app)
        .post('/negotiate')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle multiple enemy towers', async () => {
      const requestWithManyEnemies = {
        ...sampleNegotiateRequest,
        enemyTowers: [
          { playerId: 102, hp: 100, armor: 0, level: 1 },
          { playerId: 103, hp: 100, armor: 0, level: 1 },
          { playerId: 104, hp: 100, armor: 0, level: 1 }
        ]
      };

      const response = await request(app)
        .post('/negotiate')
        .send(requestWithManyEnemies)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /combat', () => {
    const sampleCombatRequest = {
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

    it('should return 200 OK with combat actions', async () => {
      const response = await request(app)
        .post('/combat')
        .send(sampleCombatRequest)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // Validate action structure if actions exist
      response.body.forEach((action: any) => {
        expect(action).toHaveProperty('type');
        expect(['armor', 'attack', 'upgrade']).toContain(action.type);
        
        if (action.type === 'armor') {
          expect(action).toHaveProperty('amount');
          expect(typeof action.amount).toBe('number');
        }
        
        if (action.type === 'attack') {
          expect(action).toHaveProperty('targetId');
          expect(action).toHaveProperty('troopCount');
        }
      });
    });

    it('should respond within 1 second', async () => {
      const start = Date.now();
      await request(app)
        .post('/combat')
        .send(sampleCombatRequest);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
    });

    it('should handle low resources', async () => {
      const lowResourceRequest = {
        ...sampleCombatRequest,
        playerTower: {
          ...sampleCombatRequest.playerTower,
          resources: 5
        }
      };

      const response = await request(app)
        .post('/combat')
        .send(lowResourceRequest)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should handle upgrade scenario', async () => {
      const upgradeRequest = {
        ...sampleCombatRequest,
        playerTower: {
          ...sampleCombatRequest.playerTower,
          resources: 60,
          hp: 80
        },
        turn: 5 // Early game
      };

      const response = await request(app)
        .post('/combat')
        .send(upgradeRequest)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should handle late game (fatigue)', async () => {
      const lateGameRequest = {
        ...sampleCombatRequest,
        turn: 30, // Late game
        playerTower: {
          ...sampleCombatRequest.playerTower,
          hp: 50,
          armor: 5
        }
      };

      const response = await request(app)
        .post('/combat')
        .send(lateGameRequest)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should handle missing fields gracefully', async () => {
      const invalidRequest = {
        gameId: 123
        // Missing required fields
      };

      const response = await request(app)
        .post('/combat')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /move (legacy)', () => {
    it('should return 200 OK', async () => {
      const response = await request(app)
        .post('/move')
        .send({ game: 'state' })
        .expect(200);

      expect(response.body).toHaveProperty('move');
    });
  });

  describe('Integration Tests', () => {
    it('should handle full game flow', async () => {
      // Turn 0: Negotiation
      const negotiateReq = {
        gameId: 999,
        turn: 0,
        playerTower: {
          playerId: 101,
          hp: 100,
          armor: 0,
          resources: 20,
          level: 1
        },
        enemyTowers: [
          { playerId: 102, hp: 100, armor: 0, level: 1 },
          { playerId: 103, hp: 100, armor: 0, level: 1 },
          { playerId: 104, hp: 100, armor: 0, level: 1 }
        ],
        combatActions: []
      };

      const negotiateRes = await request(app)
        .post('/negotiate')
        .send(negotiateReq)
        .expect(200);

      expect(Array.isArray(negotiateRes.body)).toBe(true);

      // Turn 0: Combat
      const combatReq = {
        gameId: 999,
        turn: 0,
        playerTower: {
          playerId: 101,
          hp: 100,
          armor: 0,
          resources: 20,
          level: 1
        },
        enemyTowers: [
          { playerId: 102, hp: 100, armor: 0, level: 1 },
          { playerId: 103, hp: 100, armor: 0, level: 1 },
          { playerId: 104, hp: 100, armor: 0, level: 1 }
        ],
        diplomacy: [],
        previousAttacks: []
      };

      const combatRes = await request(app)
        .post('/combat')
        .send(combatReq)
        .expect(200);

      expect(Array.isArray(combatRes.body)).toBe(true);
    });

    it('should handle multiple consecutive requests', async () => {
      const baseRequest = {
        gameId: 888,
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

      // Make multiple requests
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/negotiate')
          .send({ ...baseRequest, turn: Math.floor(Math.random() * 10) })
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      await request(app)
        .post('/negotiate')
        .send('invalid json')
        .expect(400);
    });

    it('should handle empty body', async () => {
      const response = await request(app)
        .post('/negotiate')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle very large requests', async () => {
      const largeRequest = {
        gameId: 123,
        turn: 1,
        playerTower: {
          playerId: 101,
          hp: 100,
          armor: 0,
          resources: 20,
          level: 1
        },
        enemyTowers: Array.from({ length: 100 }, (_, i) => ({
          playerId: 200 + i,
          hp: 100,
          armor: 0,
          level: 1
        })),
        combatActions: []
      };

      const response = await request(app)
        .post('/negotiate')
        .send(largeRequest)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
