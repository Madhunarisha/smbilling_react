import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { apiRouter } from '../src/server/api.js';

const app = express();

// Body parser middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'SM Autos & Batteries ERP Backend (Vercel Serverless)',
    mongoConfigured: Boolean(process.env.MONGODB_URI),
    timestamp: new Date().toISOString(),
  });
});

// Mount API routes
app.use('/api', apiRouter);

// Catch-all for undefined API routes - MUST return JSON, never fall through to HTML
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler for API requests
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error('Vercel API Server Error:', err);
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(500).json({
      error: err?.message || 'An unexpected server error occurred',
    });
  }
  next(err);
});

export default app;
