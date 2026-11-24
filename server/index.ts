import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { initDatabase } from './db.ts';
import { apiRouter } from './routes/api.ts';

const app = express();
const PORT = Number(process.env.PORT || 3001);

initDatabase();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', apiRouter);

const distDir = path.resolve(process.cwd(), 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Tower Clash API server running on http://localhost:${PORT}`);
});
