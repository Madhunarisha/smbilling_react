
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './src/server/api.js';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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
      mongoConfigured: Boolean(process.env.MONGODB_URI),
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SM Autos & Batteries ERP Server running on http://0.0.0.0:${PORT}`);
    if (process.env.MONGODB_URI) {
      const masked = process.env.MONGODB_URI.replace(/:([^@]+)@/, ':****@');
      console.log(`MongoDB URI configured: ${masked}`);
    } else {
      console.log('MongoDB URI not configured. Using local storage.');
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
