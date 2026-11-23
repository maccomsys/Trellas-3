import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { registerSupabaseAdminRoutes } from './server/supabaseAdmin.ts';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
registerSupabaseAdminRoutes(app);

app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Not found. All application data is handled via Supabase.' });
});

app.use((err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err) {
    res.status(400).json({ error: err.message || 'Request failed' });
    return;
  }
  next();
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Trellas server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
