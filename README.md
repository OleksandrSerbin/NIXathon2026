# NIXathon2026

A Node.js/Express API with health check and game AI endpoints, built with TypeScript. Prepared for hackathon game competition.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the TypeScript project:
```bash
npm run build
```

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will run on port 3000 by default (or the port specified in the `PORT` environment variable).

## Endpoints

### GET /healthz

Returns a 200 OK status with the following JSON body:

```json
{
  "status": "OK"
}
```

**Example:**
```bash
curl http://localhost:3000/healthz
```

### POST /move

Receives game state and returns optimal move.

**Request:**
```bash
curl -X POST http://localhost:3000/move \
  -H "Content-Type: application/json" \
  -d '{"game": "state", "here": true}'
```

**Response:**
```json
{
  "move": { ... },
  "confidence": 85,
  "reasoning": "Strategy: MinimaxStrategy, Confidence: 85%"
}
```

### GET /move

Alternative endpoint that accepts game state via query parameters.

## Project Structure

```
src/
├── server.ts              # Main Express server
├── types/
│   └── game.ts           # Game state and move type definitions
├── game/
│   ├── ai-strategies.ts  # AI algorithms (Minimax, MCTS, Greedy)
│   └── move-handler.ts   # Request handler for game moves
├── utils/
│   ├── logger.ts         # Logging utility
│   ├── time-manager.ts   # Time management for move calculation
│   └── ai-integration.ts # External AI API integrations (OpenAI, Anthropic)
└── tests/
    └── example-test.ts   # Example test file
```

## AI Strategies

The project includes three AI strategies:

1. **Minimax** - Optimal for perfect information, two-player games
2. **MCTS** - Best for games with uncertainty and large state spaces
3. **Greedy** - Fast heuristic-based strategy

Select strategy via environment variable:
```bash
AI_STRATEGY=minimax npm start
AI_STRATEGY=mcts npm start
AI_STRATEGY=greedy npm start
```

## External AI Integration

The project supports integration with:
- **OpenAI GPT-4** - For strategic game analysis
- **Anthropic Claude** - Alternative AI reasoning

See `HACKATHON_PREP.md` for detailed preparation guide.

## Deployment

For deployment, ensure:
- The server is publicly accessible
- The `/healthz` endpoint is reachable
- Port configuration allows external access
- Firewall/security groups allow traffic from the allowlist IP: `13.51.63.6`
- Host region: `eu-north-1` (Stockholm)

## Environment Variables

- `PORT`: Server port (default: 3000)
- `AI_STRATEGY`: AI strategy to use - `minimax`, `mcts`, or `greedy` (default: `minimax`)
- `OPENAI_API_KEY`: OpenAI API key for GPT-4 integration (optional)
- `ANTHROPIC_API_KEY`: Anthropic API key for Claude integration (optional)
- `ENABLE_LOGGING`: Enable detailed logging (default: `true` in dev, `false` in production)

## Quick Start for Hackathon

1. **Understand the game rules** - Update `src/types/game.ts` with actual game structure
2. **Implement game logic** - Fill in TODO sections in `src/game/ai-strategies.ts`
3. **Test locally** - Use `src/tests/example-test.ts` as template
4. **Deploy** - Ensure `/healthz` and `/move` endpoints are accessible

See `HACKATHON_PREP.md` for comprehensive preparation guide.