import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('offline profile, food, diary, plans and history survive a process restart and timezone change', () => {
  const directory = mkdtempSync(join(tmpdir(), 'calories-journey-'));
  try {
    const path = join(directory, 'journey.db');
    const script = fileURLToPath(new URL('./fixtures/offlineJourney.mjs', import.meta.url));
    const write = spawnSync(process.execPath, [script, path, 'write'], { env: { ...process.env, TZ: 'Asia/Tokyo' }, encoding: 'utf8', timeout: 15000 });
    assert.equal(write.status, 0, write.stderr);
    const read = spawnSync(process.execPath, [script, path, 'read', write.stdout], { env: { ...process.env, TZ: 'America/Los_Angeles' }, encoding: 'utf8', timeout: 15000 });
    assert.equal(read.status, 0, read.stderr); assert.equal(read.stdout, 'verified');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
