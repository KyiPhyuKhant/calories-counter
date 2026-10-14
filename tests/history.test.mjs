import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { buildHistory, historyRange, shiftHistoryPeriod, validateWeight } from '../src/domain/history.ts';
import { localCalendarDate, shiftCalendarDate } from '../src/domain/diary.ts';
import { initializeDatabase, migrations } from '../src/data/migrations.ts';
import { createRepositories } from '../src/data/repositories.ts';
import { adapt } from './sqlite.mjs';

const profile = { sex: 'male', age: 30, height_cm: 180, current_weight_kg: 80, target_weight_kg: 80, activity_level: 'sedentary', goal: 'maintain', manual_calorie_target: 2100 };
async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  const db = adapt(sqlite); await initializeDatabase(db);
  let time = '2026-10-14T12:00:00.000Z';
  const r = createRepositories(db, randomUUID, () => time);
  return { db, r, setTime(value) { time = value; } };
}

test('weekly and monthly ranges follow local calendar boundaries, leap years, year changes and DST', () => {
  assert.deepEqual(historyRange('2026-10-14', 'week'), { start: '2026-10-12', end: '2026-10-18' });
  assert.deepEqual(historyRange('2026-10-18', 'week'), { start: '2026-10-12', end: '2026-10-18' });
  assert.deepEqual(historyRange('2024-02-29', 'month'), { start: '2024-02-01', end: '2024-02-29' });
  assert.deepEqual(historyRange('2025-02-15', 'month'), { start: '2025-02-01', end: '2025-02-28' });
  assert.deepEqual(historyRange('2026-01-01', 'week'), { start: '2025-12-29', end: '2026-01-04' });
  assert.equal(shiftHistoryPeriod('2026-01-31', 'month', 1), '2026-02-01');
  assert.equal(shiftHistoryPeriod('2026-12-15', 'month', 1), '2027-01-01');
  assert.equal(shiftHistoryPeriod('2026-10-14', 'week', -1), '2026-10-05');
  assert.equal(historyRange('2100-12-31', 'week').end, '2100-12-31');
  assert.throws(() => historyRange('2026-02-30', 'week'));
  assert.throws(() => historyRange('2026-10-14', 'year'));
  const url = new URL('../src/domain/history.ts', import.meta.url).href;
  for (const tz of ['Asia/Tokyo', 'America/Los_Angeles']) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `import { historyRange, shiftHistoryPeriod } from ${JSON.stringify(url)};
      console.log(JSON.stringify([historyRange('2026-03-08','week'), shiftHistoryPeriod('2026-03-08','week',1)]));`], { env: { ...process.env, TZ: tz }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), [{ start: '2026-03-02', end: '2026-03-08' }, '2026-03-09']);
  }
});

test('date-based summaries classify under, at, and over days without inventing missing intake or old targets', () => {
  const range = historyRange('2026-10-14', 'week');
  const consumption = [1000, 1500, 2000, 2200, 999].map((calories, index) => ({ date: `2026-10-${12 + index}`, calories, entry_count: 1 }));
  const history = buildHistory(range, '2026-10-15', consumption, [
    { measured_date: '2026-10-12', weight_kg: 70 }, { measured_date: '2026-10-12', weight_kg: 72 },
    { measured_date: '2026-10-14', weight_kg: 69 }, { measured_date: '2026-10-16', weight_kg: 80 },
  ], [{ effective_date: '2026-10-13', target: 2000 }]);
  assert.deepEqual(history.days.map((day) => day.status), ['no-target', 'under', 'at', 'over', 'future', 'future', 'future']);
  assert.equal(history.days[0].target, null); assert.equal(history.days[5].consumed, null);
  assert.equal(history.days[1].weight, null); assert.equal(history.days[0].weight, 71);
  assert.equal(history.summary.totalCalories, 6700); assert.equal(history.summary.averageCalories, 1675);
  assert.equal(history.summary.loggedDays, 4); assert.equal(history.summary.elapsedDays, 4);
  assert.equal(history.summary.averageTarget, 2000); assert.equal(history.summary.targetDays, 3);
  assert.equal(history.summary.underDays, 1); assert.equal(history.summary.atDays, 1); assert.equal(history.summary.overDays, 1);
  assert.equal(history.summary.measurements, 3); assert.equal(history.summary.averageWeight, 211 / 3); assert.equal(history.summary.weightChange, -2);
  const empty = buildHistory(range, '2026-10-15', [], [], []);
  assert.equal(empty.summary.totalCalories, null); assert.equal(empty.summary.averageCalories, null);
  assert.equal(empty.summary.averageWeight, null); assert.equal(empty.summary.weightChange, null);
  assert.equal(empty.summary.averageTarget, null); assert.equal(empty.summary.underDays, 0);
  assert.equal(empty.days[0].status, 'no-log');
  const zero = buildHistory(range, '2026-10-15', [{ date: range.start, calories: 0, entry_count: 1 }], [], [{ effective_date: range.start, target: 2000 }]);
  assert.equal(zero.days[0].consumed, 0); assert.equal(zero.days[0].status, 'under'); assert.equal(zero.days[1].consumed, null);
  assert.equal(zero.summary.averageCalories, 0);
  const singleDay = buildHistory(range, '2026-10-15', [], [{ measured_date: range.start, weight_kg: 70 }, { measured_date: range.start, weight_kg: 72 }], []);
  assert.equal(singleDay.summary.averageWeight, 71); assert.equal(singleDay.summary.weightChange, null);
});

test('dated target changes apply forward, null resets availability, and invalid summary inputs are rejected', () => {
  const range = historyRange('2026-10-14', 'week');
  const history = buildHistory(range, '2026-10-18', [], [], [
    { effective_date: '2026-10-15', target: null }, { effective_date: '2026-10-01', target: 2000 }, { effective_date: '2026-10-14', target: 2200 },
  ]);
  assert.deepEqual(history.days.map((day) => day.target), [2000, 2000, 2200, null, null, null, null]);
  assert.equal(history.summary.averageTarget, 6200 / 3);
  assert.throws(() => buildHistory(range, '2026-10-18', [{ date: range.start, calories: NaN, entry_count: 1 }], [], []));
  assert.throws(() => buildHistory(range, '2026-10-18', [], [{ measured_date: range.start, weight_kg: NaN }], []));
  assert.throws(() => buildHistory(range, '2026-10-18', [], [], [{ effective_date: range.start, target: -1 }]));
  for (const weight of [0, 34, 301, NaN, Infinity]) assert.throws(() => validateWeight('2026-10-14', weight, '2026-10-14'));
  assert.throws(() => validateWeight('2026-10-15', 70, '2026-10-14'), /earlier/);
  assert.throws(() => validateWeight('2026-02-30', 70, '2026-10-14'));
  validateWeight('2026-10-14', 70.25, '2026-10-14');
});

test('weight CRUD retains stable IDs and local dates, supports multiple measurements, and never changes profile weight', async (t) => {
  const { db, r } = await fixture(t);
  await r.profiles.saveCalorieProfile(profile);
  let notifications = 0; r.subscribe(() => { notifications++; });
  const id = await r.weights.create('2026-10-13', 78.4);
  await r.weights.create('2026-10-13', 78.6);
  const created = await r.weights.get(id);
  assert.equal((await r.history.getPeriod('2026-10-14', 'week')).days[1].weight, 78.5);
  await r.weights.update(id, '2026-10-12', 79);
  const edited = await r.weights.get(id);
  assert.equal(edited.id, id); assert.equal(edited.created_at, created.created_at); assert.equal(edited.measured_date, '2026-10-12');
  assert.equal((await r.profiles.get()).current_weight_kg, 80);
  const history = await r.history.getPeriod('2026-10-14', 'week');
  assert.equal(history.days[0].weight, 79); assert.equal(history.days[1].weight, 78.6); assert.ok(Math.abs(history.summary.weightChange + 0.4) < 1e-9);
  await r.weights.remove(id); assert.equal(await r.weights.get(id), null);
  assert.equal(notifications, 4);
  await assert.rejects(r.weights.update('missing', '2026-10-13', 70), /not found/);
  await assert.rejects(r.weights.remove('missing'), /not found/);
  await assert.rejects(r.weights.create('2026-10-15', 70), /earlier/);
  await assert.rejects(r.weights.create('2026-10-14', NaN));
  assert.equal(notifications, 4);
  assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'), []);
});

test('weight creation can initialize an empty local profile and rolls back that profile on failure', async (t) => {
  const { db, r } = await fixture(t);
  await db.execAsync("CREATE TRIGGER fail_weight BEFORE INSERT ON weight_history BEGIN SELECT RAISE(ABORT, 'Injected weight failure'); END;");
  await assert.rejects(r.weights.create('2026-10-14', 70), /Injected/);
  assert.equal(await r.profiles.get(), null);
  await db.execAsync('DROP TRIGGER fail_weight');
  const id = await r.weights.create('2026-10-14', 70);
  assert.equal((await r.weights.get(id)).profile_id, (await r.profiles.get()).id);
  assert.equal((await r.profiles.get()).current_weight_kg, null);
  assert.equal((await r.history.getPeriod('2026-10-14', 'month')).summary.averageTarget, null);
});

test('repository calorie history reads consumed snapshots only and retains old targets across profile edits', async (t) => {
  const { db, r, setTime } = await fixture(t);
  const foodId = await r.foods.createCustom({ name: 'History test food', calories: 500, serving_amount: 1, serving_unit: 'piece' });
  const input = { meal: 'breakfast', quantity_mode: 'servings' };
  setTime('2026-10-12T12:00:00Z'); await r.profiles.saveCalorieProfile(profile);
  await r.diary.addEntry(foodId, { ...input, date: '2026-10-11', quantity: 2 });
  await r.diary.addEntry(foodId, { ...input, date: '2026-10-12', quantity: 4.2 });
  setTime('2026-10-13T12:00:00Z'); await r.profiles.saveCalorieProfile({ ...profile, manual_calorie_target: 2200 });
  await r.diary.addEntry(foodId, { ...input, date: '2026-10-13', quantity: 5 });
  setTime('2026-10-14T12:00:00Z');
  const entryId = await r.diary.addEntry(foodId, { ...input, date: '2026-10-14', quantity: 1 });
  await r.plans.addEntry(foodId, { ...input, date: '2026-10-14', quantity: 2 });
  const history = await r.history.getPeriod('2026-10-14', 'month');
  const day = (date) => history.days.find((value) => value.date === date);
  assert.equal(day('2026-10-11').status, 'no-target'); assert.equal(day('2026-10-11').target, null);
  assert.equal(day('2026-10-12').target, 2100); assert.equal(day('2026-10-12').status, 'at');
  assert.equal(day('2026-10-13').target, 2200); assert.equal(day('2026-10-13').status, 'over');
  assert.equal(day('2026-10-14').consumed, 500); assert.equal(day('2026-10-14').status, 'under');
  assert.equal(history.summary.totalCalories, 6100); assert.equal(history.summary.averageCalories, 1525);
  assert.equal(history.summary.underDays, 1); assert.equal(history.summary.atDays, 1); assert.equal(history.summary.overDays, 1);
  await r.profiles.saveCalorieProfile({ ...profile, manual_calorie_target: 2300 });
  assert.equal((await r.history.getPeriod('2026-10-14', 'week')).days[0].target, 2100);
  assert.equal((await r.history.getPeriod('2026-10-14', 'week')).days[2].target, 2300);
  await r.diary.update(entryId, { ...input, date: '2026-10-14', quantity: 4.6 });
  assert.equal((await r.history.getPeriod('2026-10-14', 'week')).days[2].status, 'at');
  await r.diary.remove(entryId);
  assert.equal((await r.history.getPeriod('2026-10-14', 'week')).days[2].consumed, null);
  // Profile and dated target writes must commit or fail together.
  await db.execAsync("CREATE TRIGGER fail_target BEFORE INSERT ON calorie_target_history BEGIN SELECT RAISE(ABORT, 'Injected target failure'); END;");
  await assert.rejects(r.profiles.saveCalorieProfile({ ...profile, age: 31 }), /Injected/);
  assert.equal((await r.profiles.get()).age, 30);
  assert.equal((await r.history.getPeriod('2026-10-14', 'week')).days[2].target, 2300);
  await db.execAsync('DROP TRIGGER fail_target');
  await r.profiles.save({ name: 'Incomplete profile', height_cm: null });
  assert.equal((await r.history.getPeriod('2026-10-14', 'week')).days[2].target, null);
  assert.equal((await r.history.getPeriod('2026-10-14', 'week')).days[0].target, 2100);
});

test('migration 6 preserves duplicate legacy measurements and IDs, seeds only an upgrade-day target, and rolls back safely', async (t) => {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close()); const db = adapt(sqlite);
  for (const migration of migrations.slice(0, 5)) await db.execAsync(migration.sql);
  await db.execAsync('PRAGMA user_version = 5');
  await db.runAsync(`INSERT INTO user_profiles (id, name, height_cm, sex, age, current_weight_kg, target_weight_kg, activity_level, goal, manual_calorie_target, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 'p', 'User', profile.height_cm, profile.sex, profile.age, profile.current_weight_kg, profile.target_weight_kg, profile.activity_level, profile.goal, profile.manual_calorie_target, 'old', 'old');
  const at = '2026-10-12T23:30:00Z';
  for (const [id, value] of [['a', 70], ['b', 71]]) await db.runAsync('INSERT INTO weight_history VALUES (?, ?, ?, ?, ?)', id, 'p', value, at, 'old');
  const original = db.execAsync;
  db.execAsync = async (sql) => { await original(sql); if (sql.includes('CREATE TABLE weights_v6')) throw new Error('Interrupted weight upgrade'); };
  await assert.rejects(initializeDatabase(db), /Interrupted/);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 5);
  assert.equal((await db.getAllAsync('SELECT id FROM weight_history')).length, 2);
  db.execAsync = original; await initializeDatabase(db);
  const r = createRepositories(db, randomUUID);
  const entries = await r.weights.list('p');
  assert.deepEqual(entries.map((entry) => entry.id).sort(), ['a', 'b']);
  assert.equal(entries[0].measured_date, localCalendarDate(new Date(at)));
  assert.equal(entries[0].created_at, 'old'); assert.equal(entries[0].measured_at, at);
  const targets = await db.getAllAsync('SELECT * FROM calorie_target_history');
  assert.equal(targets.length, 1); assert.equal(targets[0].effective_date, localCalendarDate()); assert.equal(targets[0].target, 2100);
  const earlier = shiftCalendarDate(localCalendarDate(), -1);
  assert.equal((await r.history.getPeriod(earlier, 'month')).days.find((day) => day.date === earlier).target, null);
  await initializeDatabase(db); assert.equal((await r.weights.list('p')).length, 2);
  assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'), []);
});

test('weight measurements and target changes survive database reopen', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'calories-history-')); let sqlite;
  try {
    const path = join(directory, 'history.db');
    sqlite = new DatabaseSync(path); let db = adapt(sqlite); await initializeDatabase(db);
    const now = () => '2026-10-14T12:00:00Z'; let r = createRepositories(db, randomUUID, now);
    await r.profiles.saveCalorieProfile(profile); const id = await r.weights.create('2026-10-14', 79.25);
    sqlite.close(); sqlite = new DatabaseSync(path); db = adapt(sqlite); await initializeDatabase(db);
    r = createRepositories(db, randomUUID, now);
    assert.equal((await r.weights.get(id)).weight_kg, 79.25);
    const day = (await r.history.getPeriod('2026-10-14', 'week')).days[2];
    assert.equal(day.weight, 79.25); assert.equal(day.target, 2100); assert.equal(day.consumed, null);
  } finally { sqlite?.close(); rmSync(directory, { recursive: true, force: true }); }
});
