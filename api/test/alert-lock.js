// Live alert test on tposadminfront: 5 wrong logins for a username that does not exist lock it for 15 minutes,
// which should send one "login locked" alert to the saved alert number. Nothing in the DB is changed.
import http from 'node:http';

const PORT = Number(process.env.PORT);
const APP_HOST = process.env.APP_HOST;
const KEY = process.env.APP_CLIENT_KEY;
const USERNAME = `t85_lock_${Date.now() % 100000}`;

function login() {
  const data = JSON.stringify({ username: USERNAME, password: 'wrong-password-123', device_id: 'device-lock-1' });
  const headers = {
    Host: APP_HOST, 'X-App-Key': KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data),
  };
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, method: 'POST', path: '/api/app/login', headers }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end(data);
  });
}

const codes = [];
for (let i = 0; i < 6; i++) codes.push(await login());
const ok = codes.slice(0, 5).every((c) => c === 401) && codes[5] === 429;
console.log(`${ok ? 'PASS' : 'FAIL'} 5 wrong then locked (${codes.join(',')}), username ${USERNAME}`);
console.log('Check the alert number on WhatsApp for "Sub admin login locked".');
