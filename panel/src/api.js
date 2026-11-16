// Every call to the admin API goes through this file. Pages never call fetch themselves.

export class ApiError extends Error {
  constructor(status, code, data = null) {
    super(code);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

const loginListeners = new Set();

export function onLoginRequired(fn) {
  loginListeners.add(fn);
  return () => loginListeners.delete(fn);
}

// The same GET asked twice at once (two parts of a page, React dev double render) goes out once
const inFlight = new Map();

async function send(method, path, body) {
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') {
    headers['X-Tpos-Panel'] = '1';
    if (body !== undefined) headers['Content-Type'] = 'application/json';
  }

  let res;
  try {
    res = await fetch(`/api/panel${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      redirect: 'manual',
    });
  } catch {
    throw new ApiError(0, 'network');
  }

  // Cloudflare sends a redirect to its login page when the email OTP has run out
  if (res.type === 'opaqueredirect' || res.status === 0) throw new ApiError(0, 'access_expired');

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const code = data?.error || 'server_error';
    if (res.status === 401 && code === 'login_required') loginListeners.forEach((fn) => fn());
    if (res.status === 401 && code === 'unauthorized') throw new ApiError(0, 'access_expired');
    throw new ApiError(res.status, code, data);
  }
  return data;
}

function get(path) {
  if (inFlight.has(path)) return inFlight.get(path);
  const p = send('GET', path).finally(() => inFlight.delete(path));
  inFlight.set(path, p);
  return p;
}

const post = (path, body) => send('POST', path, body);

const MESSAGES = {
  network: 'Could not reach the server. Check the internet and try again.',
  access_expired: 'Your email sign-in has expired. Reload the page and sign in again.',
  login_required: 'Please sign in again.',
  invalid_login: 'Wrong username or password.',
  account_blocked: 'This account is blocked.',
  too_many_attempts: 'Too many attempts. Try again after 15 minutes.',
  too_many_requests: 'Too many requests. Please wait a moment and try again.',
  invalid_input: 'Some of the details are not valid.',
  wrong_password: 'Current password is wrong.',
  same_password: 'The new password must be different from the current one.',
  forbidden: 'You are not allowed to do this.',
  not_found: 'Not found.',
  server_error: 'Something went wrong on the server. Please try again shortly.',
};

export function errorText(err) {
  return MESSAGES[err?.code] || MESSAGES.server_error;
}

export const api = {
  me: () => get('/me'),
  login: (username, password) => post('/login', { username, password }),
  logout: () => post('/logout'),
  changePassword: (current, password) => post('/password', { current, password }),
};
