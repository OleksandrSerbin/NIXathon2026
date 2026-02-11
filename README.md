# NIXathon2026

A simple Node.js/Express API with a health check endpoint, built with TypeScript.

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

## Deployment

For deployment, ensure:
- The server is publicly accessible
- The `/healthz` endpoint is reachable
- Port configuration allows external access
- Firewall/security groups allow traffic from the allowlist IP: `13.51.63.6`
- Host region: `eu-north-1` (Stockholm)

## Environment Variables

- `PORT`: Server port (default: 3000)