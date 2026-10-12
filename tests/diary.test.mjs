import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { calculateDiaryNutrition, dailyTotals, localCalendarDate, shiftCalendarDate, validateCalendarDate, validateDiaryInput } from '../src/domain/diary.ts';
import { createRepositories } from '../src/data/repositories.ts';
import { initializeDatabase, migrations } from '../src/data/migrations.ts';
import { adapt } from './sqlite.mjs';

const food = { name: 'Test oats', calories: 200, serving_amount: 50, serving_unit: 'g', protein: 6, carbohydrates: 30, fat: 4, notes: 'Snapshot note' };
const input = { date: '2026-10-13', meal: 'breakfast', quantity: 1, quantity_mode: 'servings' };
async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  const db = adapt(sqlite); await initializeDatabase(db);
  const r = createRepositories(db, randomUUID);
  const foodId = await r.foods.createCustom(food);
  return { db, r, foodId };
}

test('amounts and fractional servings use the declared nutrition basis, including non-mass units', () => {
  assert.equal(calculateDiaryNutrition(food, { ...input, quantity: 25, quantity_mode: 'amount' }).calories, 100);
  assert.equal(calculateDiaryNutrition(food, { ...input, quantity: 1.5 }).calories, 300);
  const volume = { ...food, serving_amount: 250, serving_unit: 'ml', protein: null };
  assert.equal(calculateDiaryNutrition(volume, { ...input, quantity: 125, quantity_mode: 'amount' }).calories, 100);
  assert.equal(calculateDiaryNutrition(volume, { ...input, quantity: 0.5 }).calories, 100);
  assert.equal(calculateDiaryNutrition(volume, input).protein, null);
  assert.equal(calculateDiaryNutrition({ ...food, serving_amount: 1, serving_unit: 'piece' }, { ...input, quantity: 2 }).calories, 400);
  for (const quantity of [0, -1, NaN, Infinity, 100001]) assert.throws(() => calculateDiaryNutrition(food, { ...input, quantity }));
  assert.throws(() => calculateDiaryNutrition(food, { ...input, quantity: 5000 }), /serving amount/);
  assert.throws(() => validateDiaryInput({ ...input, meal: 'brunch' }), /meal|breakfast/);
  assert.throws(() => validateDiaryInput({ ...input, quantity_mode: 'unknown' }));
});

test('calendar dates validate leap years, roll across months, and keep local days across timezones and DST', () => {
  for (const value of ['2026-02-30', '2025-02-29', '2026-13-01', '2026-1-1', 'not a date', '1899-12-31']) assert.throws(() => validateCalendarDate(value));
  assert.equal(shiftCalendarDate('2024-02-28', 1), '2024-02-29');
  assert.equal(shiftCalendarDate('2024-02-29', 1), '2024-03-01');
  assert.equal(shiftCalendarDate('2026-01-01', -1), '2025-12-31');
  const moduleUrl = new URL('../src/domain/diary.ts', import.meta.url).href;
  for (const [tz, expected] of [['Asia/Tokyo', '2026-10-13'], ['America/Los_Angeles', '2026-10-12']]) {
    const code = `import { localCalendarDate, shiftCalendarDate } from ${JSON.stringify(moduleUrl)};
      console.log(JSON.stringify([localCalendarDate(new Date('2026-10-12T23:30:00Z')),
        shiftCalendarDate('2026-03-07', 1), shiftCalendarDate('2026-03-08', 1), shiftCalendarDate('2026-11-01', 1)]));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, TZ: tz }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), [expected, '2026-03-08', '2026-03-09', '2026-11-02']);
  }
});

test('logging works without profile setup, saves four meals, and separates previous and future days', async (t) => {
  const { db, r, foodId } = await fixture(t);
  assert.equal(await r.profiles.get(), null);
  const milkId = await r.foods.createCustom({ ...food, name: 'Test milk', calories: 120, serving_amount: 250, serving_unit: 'ml', protein: null });
  const cupId = await r.foods.createCustom({ ...food, name: 'Test rice', serving_amount: 1, serving_unit: 'cup' });
  await r.diary.addEntry(milkId, { ...input, quantity: 0.5 });
  await r.diary.addEntry(milkId, { ...input, meal: 'lunch', quantity: 2 });
  await r.diary.addEntry(cupId, { ...input, meal: 'dinner', quantity: 2 });
  await r.diary.addEntry(foodId, { ...input, meal: 'snacks', quantity: 25, quantity_mode: 'amount' });
  await r.diary.addEntry(foodId, { ...input, date: '2026-10-12' });
  await r.diary.addEntry(foodId, { ...input, date: '2026-10-14' });
  const entries = await r.diary.listDay(input.date);
  assert.equal(entries.length, 4);
  assert.deepEqual(dailyTotals(entries), { byMeal: { breakfast: 60, lunch: 240, dinner: 400, snacks: 100 }, total: 800 });
  await r.plans.add((await r.profiles.get()).id, foodId, 100, '2026-10-13T00:00:00Z');
  assert.equal(dailyTotals(await r.diary.listDay(input.date)).total, 800);
  assert.equal((await r.diary.listDay('2026-10-12')).length, 1);
  assert.equal((await r.diary.listDay('2026-10-14')).length, 1);
  assert.equal((await r.diary.listDay('2026-10-15')).length, 0);
  assert.equal((await db.getFirstAsync('SELECT count(*) AS count FROM user_profiles')).count, 1);
  assert.deepEqual(dailyTotals([]), { byMeal: { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 }, total: 0 });
});

test('logged entries and their calendar dates persist after reopening the database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'calories-diary-'));
  let sqlite;
  try {
    const path = join(directory, 'diary.db');
    sqlite = new DatabaseSync(path);
    let db = adapt(sqlite); await initializeDatabase(db);
    let r = createRepositories(db, randomUUID);
    const foodId = await r.foods.createCustom(food);
    const id = await r.diary.addEntry(foodId, { ...input, quantity: 1.5 });
    sqlite.close(); sqlite = null;
    sqlite = new DatabaseSync(path);
    db = adapt(sqlite); await initializeDatabase(db); r = createRepositories(db, randomUUID);
    const entry = await r.diary.get(id);
    assert.equal(entry.entry_date, input.date); assert.equal(entry.quantity, 1.5);
    assert.equal(dailyTotals(await r.diary.listDay(input.date)).total, 300);
  } finally {
    sqlite?.close(); rmSync(directory, { recursive: true, force: true });
  }
});

test('snapshots survive catalog edits and deletion; diary edits retain nutrition and update day and meal', async (t) => {
  const { r, foodId } = await fixture(t);
  const id = await r.diary.addEntry(foodId, input);
  const original = await r.diary.get(id);
  await r.foods.updateCustom(foodId, { ...food, name: 'New catalog name', calories: 900, serving_amount: 1, serving_unit: 'cup', notes: 'Changed note' });
  await r.foods.remove(foodId);
  await r.diary.update(id, { date: '2026-10-14', meal: 'dinner', quantity: 25, quantity_mode: 'amount' });
  const entry = await r.diary.get(id);
  for (const key of ['name', 'calories', 'serving_amount', 'serving_unit', 'protein', 'carbohydrates', 'fat', 'notes', 'source', 'created_at']) assert.equal(entry[key], original[key]);
  assert.equal(entry.food_id, null); assert.equal(entry.total_calories, 100); assert.equal(entry.total_protein, 3);
  assert.equal((await r.diary.listDay(input.date)).length, 0);
  assert.equal(dailyTotals(await r.diary.listDay('2026-10-14')).byMeal.dinner, 100);
  await r.diary.remove(id);
  assert.equal(await r.diary.get(id), null);
  assert.equal(dailyTotals(await r.diary.listDay('2026-10-14')).total, 0);
  await assert.rejects(r.diary.update(id, input), /not found/);
  await assert.rejects(r.diary.remove(id), /not found/);
});

test('optional nutrition, development labels and external identity are preserved in snapshots', async (t) => {
  const { r } = await fixture(t);
  const id = await r.foods.saveExternal('test-provider', 'external-1', { ...food, protein: null, fat: 0 });
  const logged = await r.diary.addEntry(id, input);
  const entry = await r.diary.get(logged);
  assert.equal(entry.source, 'external'); assert.equal(entry.provider, 'test-provider'); assert.equal(entry.external_id, 'external-1');
  assert.equal(entry.total_protein, null); assert.equal(entry.total_fat, 0);
  const demo = await r.diary.get(await r.diary.addEntry('dev:apple:v1', input));
  assert.equal(demo.source, 'bundled'); assert.match(demo.notes, /invented/);
});

test('invalid dates, quantities and missing foods do not create entries or profiles; failed inserts roll back', async (t) => {
  const { db, r, foodId } = await fixture(t);
  await assert.rejects(r.diary.addEntry(foodId, { ...input, date: '2026-02-30' }));
  await assert.rejects(r.diary.addEntry(foodId, { ...input, quantity: NaN }));
  await assert.rejects(r.diary.addEntry('missing', input), /Food not found/);
  await assert.rejects(r.diary.addEntry(foodId, input, 'missing'), /Profile not found/);
  assert.equal(await r.profiles.get(), null);
  const original = db.runAsync;
  db.runAsync = async (sql, ...params) => {
    if (sql.includes('INSERT INTO diary_entries')) throw new Error('Simulated write failure');
    return original(sql, ...params);
  };
  await assert.rejects(r.diary.addEntry(foodId, input), /write failure/);
  assert.equal(await r.profiles.get(), null);
  assert.equal((await r.diary.listDay(input.date)).length, 0);
  db.runAsync = original;
  const id = await r.diary.addEntry(foodId, input);
  await assert.rejects(r.diary.update(id, { ...input, quantity: 0 }));
  assert.equal((await r.diary.get(id)).total_calories, 200);
  await assert.rejects(db.runAsync('UPDATE diary_entries SET entry_date = ? WHERE id = ?', '2026-02-30', id), /CHECK/);
});

test('migration 4 preserves gram snapshots and food links, resolves legacy local dates, and rolls back safely', async (t) => {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  const db = adapt(sqlite);
  for (const migration of migrations.slice(0, 3)) await db.execAsync(migration.sql);
  await db.execAsync('PRAGMA user_version = 3');
  const r = createRepositories(db, randomUUID);
  const profileId = await r.profiles.save({ name: 'User' });
  const foodId = await r.foods.createCustom({ ...food, name: 'Changed catalog', calories: 999 });
  const at = '2026-10-12T23:30:00.000Z';
  await db.runAsync('INSERT INTO diary_entries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    'legacy-entry', profileId, foodId, 'Original snapshot', 200, null, 30, 4, 25, at, at);
  const original = db.execAsync;
  db.execAsync = async (sql) => { await original(sql); if (sql.includes('CREATE TABLE diary_v4')) throw new Error('Interrupted migration'); };
  await assert.rejects(initializeDatabase(db), /Interrupted/);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 3);
  assert.equal((await db.getFirstAsync('SELECT name FROM diary_entries')).name, 'Original snapshot');
  assert.equal((await db.getFirstAsync('PRAGMA foreign_keys')).foreign_keys, 1);
  db.execAsync = original; await initializeDatabase(db);
  const entry = await r.diary.get('legacy-entry');
  assert.equal(entry.name, 'Original snapshot'); assert.equal(entry.serving_amount, 100); assert.equal(entry.serving_unit, 'g');
  assert.equal(entry.calories, 200); assert.equal(entry.total_calories, 50); assert.equal(entry.protein, null);
  assert.equal(entry.food_id, foodId); assert.equal(entry.entry_date, localCalendarDate(new Date(at))); assert.equal(entry.meal, 'snacks');
  await initializeDatabase(db);
  assert.equal((await r.diary.listDay(entry.entry_date)).length, 1);
  assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'), []);
});
