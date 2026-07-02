import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createBusySource } from '../src/busy.js';

const FIXTURE_URL = pathToFileURL(new URL('./fixtures/busy.ics', import.meta.url).pathname).href;
const NOW = new Date('2026-07-01T00:00:00Z');

function fixtureSource(overrides = {}) {
  return createBusySource({ url: FIXTURE_URL, ttlSeconds: 300, horizonDays: 30, now: () => NOW, ...overrides });
}

test('parses single events and expands weekly RRULE within the horizon', async () => {
  const intervals = await fixtureSource().getBusyIntervals();
  const starts = intervals.map((iv) => iv.start.toISOString());

  assert.ok(starts.includes('2026-07-02T12:00:00.000Z'));
  // Weekly Monday 08:00Z occurrences across the 30-day horizon.
  for (const monday of ['2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27']) {
    assert.ok(starts.includes(`${monday}T08:00:00.000Z`), `missing ${monday}`);
  }
  // Events entirely in the past are dropped.
  assert.ok(!starts.includes('2026-01-01T09:00:00.000Z'));
});

test('fails closed when no fetch has ever succeeded', async () => {
  const source = fixtureSource({ loader: async () => { throw new Error('boom'); } });
  await assert.rejects(() => source.getBusyIntervals(), /boom/);
});

test('serves stale cache when a later refresh fails', async () => {
  let calls = 0;
  let clock = NOW;
  const source = fixtureSource({
    now: () => clock,
    loader: async (url) => {
      calls++;
      if (calls > 1) throw new Error('link revoked');
      const { readFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      return readFile(fileURLToPath(url), 'utf8');
    },
  });

  const first = await source.getBusyIntervals();
  assert.ok(first.length > 0);

  clock = new Date(NOW.getTime() + 3600 * 1000); // cache is now stale
  const second = await source.getBusyIntervals();
  assert.deepEqual(second, first);
  assert.equal(calls, 2);
});

test('fresh cache is reused without refetching', async () => {
  let calls = 0;
  const source = fixtureSource({
    loader: async (url) => {
      calls++;
      const { readFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      return readFile(fileURLToPath(url), 'utf8');
    },
  });
  await source.getBusyIntervals();
  await source.getBusyIntervals();
  assert.equal(calls, 1);
});
