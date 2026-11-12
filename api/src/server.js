import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import appRoutes from './routes/app.js';
import panelRoutes from './routes/panel.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(helmet());
app.use(express.json({ limit: '100kb' }));

function onlyHost(host) {
  return (req, res, next) => {
    if (req.hostname !== host) return res.status(404).json({ error: 'not_found' });
    next();
  };
}

app.use('/api/panel', onlyHost(config.panelHost), panelRoutes);
app.use('/api/app', onlyHost(config.appHost), appRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'not_found' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(400).json({ error: 'invalid_input' });
  }
  console.error(`${req.method} ${req.path} ${err.message}`);
  res.status(500).json({ error: 'server_error' });
});

app.listen(config.port, '127.0.0.1', () => {
  console.log(`admin api on 127.0.0.1:${config.port}`);
});
