import express, { Request, Response } from 'express';

const app = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);

// Health check endpoint
app.get('/healthz', (req: Request, res: Response): void => {
  res.status(200).json({ status: 'OK' });
});

// Start server
app.listen(PORT, (): void => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check endpoint: http://localhost:${PORT}/healthz`);
});
