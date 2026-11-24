import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { initDatabase } from './db.ts';
import { apiRouter } from './routes/api.ts';

let initialized = false;

export function createApp(options?: { serveStatic?: boolean }) {
  if (!initialized) {
    initDatabase();
    initialized = true;
  }

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', apiRouter);

  const shouldServeStatic = options?.serveStatic ?? process.env.NODE_ENV === 'production';
  const distDir = path.resolve(process.cwd(), 'dist');
  if (shouldServeStatic && fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}
