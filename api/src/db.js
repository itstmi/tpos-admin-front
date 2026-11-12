import { readFileSync } from 'node:fs';
import { config } from './config.js';

const apiKey = readFileSync(config.dbKeyFile, 'utf8').trim();

export class DbError extends Error {
  constructor(status, body) {
    super(`db ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function call(method, path, { query, body, prefer } = {}) {
  const url = new URL(path, config.dbUrl);
  if (query) url.search = new URLSearchParams(query).toString();

  const headers = { apikey: apiKey, Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new DbError(res.status, data);
  return data;
}

export const db = {
  select: (table, query) => call('GET', table, { query }),
  insert: (table, rows, query) =>
    call('POST', table, { query, body: rows, prefer: 'return=representation' }),
  update: (table, query, patch) =>
    call('PATCH', table, { query, body: patch, prefer: 'return=representation' }),
  remove: (table, query) => call('DELETE', table, { query }),
  rpc: (fn, args) => call('POST', `rpc/${fn}`, { body: args ?? {} }),
};
