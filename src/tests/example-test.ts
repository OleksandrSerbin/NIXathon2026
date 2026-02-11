/**
 * Example test file for game move calculation
 * Use this as a template for testing your game logic
 */

import { MoveHandler } from '../game/move-handler';
import { Request, Response } from 'express';

// Example: Test with a simple game state
async function testMoveCalculation() {
  const handler = new MoveHandler('greedy');
  
  // Mock request
  const mockReq = {
    body: {
      // Example game state - update based on actual game
      board: [
        [null, null, null],
        [null, null, null],
        [null, null, null]
      ],
      currentPlayer: 'X',
      turn: 1
    }
  } as Request;

  const mockRes = {
    status: (code: number) => ({
      json: (data: any) => {
        console.log(`Status: ${code}`);
        console.log('Response:', JSON.stringify(data, null, 2));
        return mockRes;
      }
    }),
    json: (data: any) => {
      console.log('Response:', JSON.stringify(data, null, 2));
      return mockRes;
    }
  } as unknown as Response;

  await handler.handleMove(mockReq, mockRes);
}

// Run test
if (require.main === module) {
  testMoveCalculation().catch(console.error);
}

export { testMoveCalculation };
