const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('service worker bypasses private requests across logout and account switching', () => {
  const handlers = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8'), {
    URL,
    self: { location: { origin: 'https://example.invalid' }, addEventListener: (name, fn) => { handlers[name] = fn; } },
  });
  let interceptions = 0;
  for (const token of ['Bearer account-a', null, 'Bearer account-b']) {
    for (const route of ['/api/budget', '/api/shopping-lists', '/app', '/app/reports']) {
      handlers.fetch({ request: { method: 'GET', url: `https://example.invalid${route}`, headers: new Headers(token ? { Authorization: token } : {}) }, respondWith: () => { interceptions++; } });
    }
  }
  assert.equal(interceptions, 0);
});
