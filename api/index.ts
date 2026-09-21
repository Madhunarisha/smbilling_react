import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { apiRouter } from '../src/server/api.js';
import { initDb, db } from '../src/server/db.js';

if (!process.env.SQLITECLOUD_URL || !process.env.SQLITECLOUD_URL.startsWith('sqlitecloud://')) {
  process.env.SQLITECLOUD_URL = 'sqlitecloud://clhixlrlvk.g2.sqlite.cloud:8860/SMDB?apikey=m7SpwhsWexbaCs7Z69puOeKQgDY7a3CPbPHN5l8vCOo';
}

const app = express();

// Body parser middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize SQLite Cloud schema once on cold start or reconnection
let dbReady = false;
let dbInitError: Error | null = null;

const ensureDb = async () => {
  if (dbReady && db.isConnected()) return;
  let attempts = 0;
  const maxAttempts = 4;
  let lastErr: any = null;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      await initDb();
      dbReady = true;
      dbInitError = null;
      return;
    } catch (err: any) {
      dbReady = false;
      dbInitError = err;
      lastErr = err;
      console.warn(`[ensureDb] Init attempt ${attempts}/${maxAttempts} failed. Retrying in 1.5s...`, err?.message);
      if (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }
  throw lastErr;
};

// Middleware: ensure DB is initialized before any API request
app.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ensureDb();
    next();
  } catch (err: any) {
    console.error('DB init failed:', err);
    res.status(500).json({
      error: 'Database initialization failed: ' + (err?.message || 'Unknown error'),
    });
  }
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'SM Autos & Batteries ERP Backend (Vercel Serverless)',
    sqliteCloudConfigured: Boolean(process.env.SQLITECLOUD_URL),
    dbReady,
    dbConnected: db.isConnected(),
    timestamp: new Date().toISOString(),
  });
});

// Mount API routes
app.use('/api', apiRouter);

// Catch-all for undefined API routes
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
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
