
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './src/server/api.js';
import { initDb } from './src/server/db.js';


async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Initialize SQLite Cloud — creates tables & seeds defaults
  await initDb();

  // Body parser middlewares
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Mount API routes
  app.use('/api', apiRouter);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'SM Autos & Batteries ERP Backend',
      sqliteCloudConfigured: Boolean(process.env.SQLITECLOUD_URL),
      timestamp: new Date().toISOString(),
    });
  });

  // Catch-all for undefined API routes - MUST return JSON, never fall through to Vite HTML
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      error: `API route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // Global error handler for API requests
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }
    console.error('API Server Error:', err);
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(500).json({
        error: err?.message || 'An unexpected server error occurred',
      });
    }
    next(err);
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`SM Autos & Batteries ERP Server running on http://0.0.0.0:${PORT}`);
    console.log('Connected to SQLite Cloud (SMDB).');
  });

  server.on('error', async (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`\n⚠️  Port ${PORT} is already in use. Killing existing process and retrying...\n`);
      const { execSync } = await import('child_process');
      try {
        execSync(`lsof -ti tcp:${PORT} | xargs kill -9`, { stdio: 'ignore' });
      } catch {}
      setTimeout(() => {
        server.close();
        app.listen(PORT, '0.0.0.0', () => {
          console.log(`SM Autos & Batteries ERP Server running on http://0.0.0.0:${PORT}`);
          console.log('Connected to SQLite Cloud (SMDB).');
        });
      }, 1500);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });

  // Graceful shutdown on Ctrl+C
  process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.close(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
