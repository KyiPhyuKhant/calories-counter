import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { calendarDateLabel } from '../src/domain/diary.ts';

test('date labels use the stored Gregorian calendar even on Buddhist-calendar devices', () => {
  const original = Date.prototype.toLocaleDateString;
  Date.prototype.toLocaleDateString = () => '15 Oct 2569 BE';
  try {
    assert.equal(calendarDateLabel('2026-10-15'), '15 Oct 2026');
    assert.equal(calendarDateLabel('2024-02-29'), '29 Feb 2024');
  } finally { Date.prototype.toLocaleDateString = original; }
  assert.throws(() => calendarDateLabel('2026-02-30'));
});

test('calendar arithmetic remains correct at the date line, new year and daylight saving boundaries', () => {
  const url = new URL('../src/domain/diary.ts', import.meta.url).href;
  for (const [timezone, expected] of [['Asia/Tokyo', '2026-12-31'], ['America/Los_Angeles', '2026-12-31'], ['Pacific/Kiritimati', '2027-01-01'], ['Pacific/Pago_Pago', '2026-12-31']]) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { localCalendarDate, shiftCalendarDate, calendarDateLabel } from ${JSON.stringify(url)};
      console.log(JSON.stringify([
        localCalendarDate(new Date('2026-12-31T12:30:00Z')),
        shiftCalendarDate('2026-03-08', 1), shiftCalendarDate('2026-11-01', 1),
        calendarDateLabel('2026-10-15')
      ]));`], { env: { ...process.env, TZ: timezone }, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    const [date, spring, autumn, label] = JSON.parse(result.stdout);
    assert.equal(date, expected); assert.equal(spring, '2026-03-09'); assert.equal(autumn, '2026-11-02');
    assert.ok(label.includes('2026'));
  }
});
