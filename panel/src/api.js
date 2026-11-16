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

const id = (value) => encodeURIComponent(value);

function query(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

// Text file downloads (customer export). The browser saves it under the name the server gives.
async function download(path) {
  let res;
  try {
    res = await fetch(`/api/panel${path}`, { credentials: 'same-origin', redirect: 'manual' });
  } catch {
    throw new ApiError(0, 'network');
  }
  if (res.type === 'opaqueredirect' || res.status === 0) throw new ApiError(0, 'access_expired');
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const code = data?.error || 'server_error';
    if (res.status === 401 && code === 'login_required') loginListeners.forEach((fn) => fn());
    throw new ApiError(res.status, code, data);
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || 'export.txt';
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

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
  bad_state: 'This bill has already changed. The list is refreshed.',
  trial_ended: 'Trial has ended. Make it paid or extend the trial to open it.',
  NOT_TRIAL: 'This ISP is not on trial.',
  NOT_FOUND: 'Not found.',
  NOT_ALLOWED: 'You are not allowed to do this.',
  INVALID_INPUT: 'Some of the details are not valid.',
  invalid_area: 'This area does not belong to the ISP.',
  PHONE_EXISTS: 'An ISP with this phone number already exists.',
  CHARGES_BELOW_TPOS: 'Monthly charges cannot be less than the TPOS amount.',
  USERNAME_EXISTS: 'This username is already taken.',
  HAS_HISTORY: 'This sub admin has money records, so it cannot be deleted. Block it instead.',
  HANDOVER_CHANGED: 'New collections came in. The amounts are refreshed, check and save again.',
  NOTHING_TO_HANDOVER: 'Nothing is due from this sub admin.',
  AMOUNT_EXCEEDS_DUE: 'Received amount is more than what is due.',
  INVALID_AMOUNT: 'Amount is not valid.',
  SUB_ADMIN_NOT_FOUND: 'Sub admin not found.',
  whatsapp_unavailable: 'WhatsApp server is not reachable right now.',
  not_started: 'WhatsApp is not started yet. Press Connect.',
  no_alert_phone: 'Save an alert number first.',
  NAME_MISMATCH: 'The name does not match the ISP name.',
  UNSETTLED: 'This ISP has bills waiting approval or not yet handed over by a sub admin. Settle them first.',
  WHATSAPP_ON: 'Turn off WhatsApp for this ISP first, wait 10 minutes, then delete.',
};

export function errorText(err) {
  return MESSAGES[err?.code] || MESSAGES.server_error;
}

export const api = {
  me: () => get('/me'),
  login: (username, password) => post('/login', { username, password }),
  logout: () => post('/logout'),
  changePassword: (current, password) => post('/password', { current, password }),

  dashboard: () => get('/dashboard'),
  isps: () => get('/isps'),
  ispCharges: (ispId) => get(`/isps/${id(ispId)}/charges`),
  chargePaid: (chargeId) => post(`/charges/${id(chargeId)}/paid`),
  chargeApprove: (chargeId) => post(`/charges/${id(chargeId)}/approve`),
  chargeReject: (chargeId) => post(`/charges/${id(chargeId)}/reject`),
  ispControls: (ispId) => get(`/isps/${id(ispId)}/controls`),
  setControl: (ispId, control, enabled) => post(`/isps/${id(ispId)}/controls`, { control, enabled }),
  setBlock: (ispId, blocked) => post(`/isps/${id(ispId)}/block`, { blocked }),
  makePaid: (ispId) => post(`/isps/${id(ispId)}/make-paid`),
  deleteIsp: (ispId, confirmName) => post(`/isps/${id(ispId)}/delete`, { confirm_name: confirmName }),
  extendTrial: (ispId, days) => post(`/isps/${id(ispId)}/extend-trial`, { days }),
  ispAreas: (ispId) => get(`/isps/${id(ispId)}/areas`),
  importCustomers: (ispId, areaId, customers) => post(`/isps/${id(ispId)}/import`, { area_id: areaId || null, customers }),
  ispActivity: (ispId, { user, search, page }) => get(`/isps/${id(ispId)}/activity${query({ user, search, page })}`),
  exportCustomers: (ispId) => download(`/export${query({ isp: ispId })}`),
  createIsp: (body) => post('/isps', body),
  approvals: () => get('/approvals'),

  subAdmins: () => get('/admins'),
  subAdminDues: () => get('/sub-admins'),
  subAdmin: (subId) => get(`/sub-admins/${id(subId)}`),
  newPassword: () => get('/admins/new-password'),
  createSubAdmin: (body) => post('/admins', body),
  handover: (subId, body) => post(`/sub-admins/${id(subId)}/handover`, body),
  setTposRate: (subId, tposAmount) => post(`/sub-admins/${id(subId)}/tpos-rate`, { tpos_amount: tposAmount }),
  setTrialLimit: (subId, trialLimit) => post(`/sub-admins/${id(subId)}/trial-limit`, { trial_limit: trialLimit }),
  setSubProfile: (subId, name, city) => post(`/admins/${id(subId)}/profile`, { name, city }),
  resetSubPassword: (subId, password) => post(`/admins/${id(subId)}/password`, { password }),
  blockSubAdmin: (subId, blocked, isps) => post(`/admins/${id(subId)}/block`, { blocked, isps }),
  deleteSubAdmin: (subId) => send('DELETE', `/admins/${id(subId)}`),

  report: (start, end) => get(`/report${query({ start, end })}`),
  collections: (start, end, by, page) => get(`/collections${query({ start, end, by, page })}`),
  expenses: (start, end, page) => get(`/expenses${query({ start, end, page })}`),
  addExpense: (body) => post('/expenses', body),
  deleteExpense: (expenseId) => send('DELETE', `/expenses/${id(expenseId)}`),

  staffLogs: (admin, page) => get(`/logs/staff${query({ admin, page })}`),

  whatsappStatus: () => get('/whatsapp/status'),
  whatsappConnect: () => post('/whatsapp/connect'),
  whatsappQr: () => get('/whatsapp/qr'),
  whatsappDisconnect: () => post('/whatsapp/disconnect'),
  whatsappMessages: (search, page) => get(`/whatsapp/messages${query({ search, page })}`),

  alerts: () => get('/alerts'),
  setAlertPhone: (phone) => post('/alerts/phone', { phone }),
  testAlert: () => post('/alerts/test'),
};
