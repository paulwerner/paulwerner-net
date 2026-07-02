import express from 'express';
import { loadConfig } from './config.js';

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const app = express();
// Caddy is the only client; trust its X-Forwarded-For so req.ip is the visitor.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '4kb' }));

app.get('/api/book/health', (req, res) => {
  res.json({ ok: true, busyFetchedAt: null, db: 'pending' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(400).json({ error: 'bad_request' });
  }
  console.error('unhandled error:', err);
  res.status(500).json({ error: 'internal' });
});

const server = app.listen(config.port, () => {
  console.log(`booking service listening on :${config.port}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    // Docker's stop timeout is the real backstop; this keeps shutdown prompt.
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
