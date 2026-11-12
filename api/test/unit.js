import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { hashPassword, verifyPassword, fakeVerify } from '../src/passwords.js';
import { newToken, hashToken, TOKEN_PATTERN } from '../src/tokens.js';

const started = Date.now();
const stored = await hashPassword('correct horse battery staple');
const took = Date.now() - started;
assert.match(stored, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
assert.deepEqual(await verifyPassword('correct horse battery staple', stored), { ok: true, needsRehash: false });
assert.equal((await verifyPassword('wrong', stored)).ok, false);
assert.notEqual(await hashPassword('same'), await hashPassword('same'));

const legacy = createHash('sha256').update('old password').digest('hex');
assert.deepEqual(await verifyPassword('old password', legacy), { ok: true, needsRehash: true });
assert.equal((await verifyPassword('other', legacy)).ok, false);

const older = stored.replace('m=19456,t=2', 'm=8192,t=3');
assert.equal((await verifyPassword('correct horse battery staple', older)).ok, false);
assert.equal((await verifyPassword('x', '')).ok, false);
assert.equal((await verifyPassword('x', '$argon2id$v=19$m=999999999,t=2,p=1$AAAA$AAAA')).ok, false);
assert.equal((await fakeVerify('x')).ok, false);

const t = newToken();
assert.match(t.token, TOKEN_PATTERN);
assert.equal(t.hash, hashToken(t.token));
assert.notEqual(newToken().token, t.token);

console.log(`UNIT OK (one hash ${took} ms)`);
