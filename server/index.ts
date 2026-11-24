import { createApp } from './app.ts';

const PORT = Number(process.env.PORT || 3001);
const app = createApp({ serveStatic: process.env.NODE_ENV === 'production' });

app.listen(PORT, () => {
  console.log(`Tower Clash API server running on http://localhost:${PORT}`);
});
