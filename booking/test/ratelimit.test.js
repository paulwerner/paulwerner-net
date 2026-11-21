import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientKey, createRateLimiter } from '../src/ratelimit.js';

test('IPv4 is keyed per address, IPv6 per /64', () => {
  assert.equal(clientKey('203.0.113.7'), '203.0.113.7');
  assert.equal(clientKey('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(clientKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), '2001:db8:1:2::/64');
  assert.equal(clientKey('2001:0DB8:1:2::1'), '2001:db8:1:2::/64');
  assert.equal(clientKey('2001:db8::1'), '2001:db8:0:0::/64');
});

test('addresses from one IPv6 /64 share a budget', () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
  const run = (ip) => {
    let status = 200;
    limiter({ ip }, { status: (code) => ({ json: () => { status = code; } }) }, () => {});
    return status;
  };
  assert.equal(run('2001:db8:1:2::1'), 200);
  assert.equal(run('2001:db8:1:2::2'), 200);
  assert.equal(run('2001:db8:1:2::3'), 429);
  assert.equal(run('2001:db8:1:3::1'), 200);
});
