import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import crypto from 'node:crypto';

test('admin password hashes to the secure SHA-256 digest', () => {
  const hash = crypto.createHash('sha256').update('admin777').digest('hex');
  assert.equal(hash, '192f49ec815fd50b252bb7c366b4c1071bffba812f654d0af9eb70a06237c0c2');

  const wrongHash = crypto.createHash('sha256').update('admin').digest('hex');
  assert.notEqual(wrongHash, '192f49ec815fd50b252bb7c366b4c1071bffba812f654d0af9eb70a06237c0c2');
});

test('admin auth script does not expose plaintext password and contains hash verification', async () => {
  const authCode = await readFile(new URL('../admin/auth.js', import.meta.url), 'utf8');

  // Must not leak the plaintext password in code
  assert.equal(authCode.includes('admin777'), false, 'Plaintext password must not be stored in auth.js');

  // Must contain the expected encrypted hash
  assert.equal(authCode.includes('192f49ec815fd50b252bb7c366b4c1071bffba812f654d0af9eb70a06237c0c2'), true);
});

test('all admin pages include auth.css and auth.js in head', async () => {
  const pages = ['index.html', 'categories.html', 'levels.html', 'settings.html'];
  for (const page of pages) {
    const html = await readFile(new URL(`../admin/${page}`, import.meta.url), 'utf8');
    assert.equal(html.includes('auth.css'), true, `${page} must include auth.css`);
    assert.equal(html.includes('auth.js'), true, `${page} must include auth.js`);
  }
});
