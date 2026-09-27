import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import investigationRouter from './routes/investigation';
import { validateGitHubUrl } from './services/gitService';

const app = express();
const PORT = parseInt(String(process.env['PORT'] ?? '3001'), 10);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Root and health check
app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'ReproForge backend is running', health: '/api/health' });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Validate GitHub URL without starting investigation
app.post('/api/validate-url', (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) {
    res.status(400).json({ valid: false, error: 'url is required.' });
    return;
  }
  const result = validateGitHubUrl(url);
  res.json(result);
});

app.use('/api/investigation', investigationRouter);

const server = app.listen(PORT, () => {
  console.log(`ReproForge backend running on http://localhost:${PORT}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Kill the existing process first:`);
    console.error(`  Get-NetTCPConnection -LocalPort ${PORT} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`);
    process.exit(1);
  } else {
    throw err;
  }
});
