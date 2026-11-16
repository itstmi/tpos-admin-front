// Serves the built panel (panel/dist, copied by device/05-panel.sh) on the panel host only.
// Cloudflare Access stands in front of the whole host, so the page itself is never public.
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config } from './config.js';

export function panelStatic() {
  const dir = config.panelDir;
  const index = path.join(dir, 'index.html');
  const files = express.static(dir, {
    index: false,
    dotfiles: 'ignore',
    setHeaders(res, file) {
      // Vite puts a content hash in every file name under assets/
      if (file.startsWith(path.join(dir, 'assets') + path.sep)) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.set('Cache-Control', 'no-cache');
      }
    },
  });

  return (req, res, next) => {
    if (req.hostname !== config.panelHost || req.path.startsWith('/api/')) return next();
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    files(req, res, () => {
      if (!existsSync(index)) return next();
      res.set('Cache-Control', 'no-cache');
      res.sendFile(index);
    });
  };
}
