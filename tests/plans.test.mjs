import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { initializeDatabase, migrations } from '../src/data/migrations.ts';
import { createRepositories } from '../src/data/repositories.ts';
import { dailyTotals, localCalendarDate } from '../src/domain/diary.ts';
import { adapt } from './sqlite.mjs';

const now = () => '2026-10-13T12:00:00.000Z';
const today = localCalendarDate(new Date(now()));
const food = { name: 'Plan test drink', calories: 200, serving_amount: 250, serving_unit: 'ml', protein: null, carbohydrates: 30, fat: 4, notes: 'Original plan note' };
const input = { date: '2026-10-20', meal: 'breakfast', quantity: 1.5, quantity_mode: 'servings' };
async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  const db = adapt(sqlite); await initializeDatabase(db);
  const r = createRepositories(db, randomUUID, now);
  const foodId = await r.foods.createCustom(food);
  return { db, r, foodId };
}

test('planning supports four meals, non-mass quantities, edits, deletion, date separation, and never counts as consumed', async (t) => {
  const { r, foodId } = await fixture(t);
  let notifications = 0; r.subscribe(() => { notifications++; });
  const id = await r.plans.addEntry(foodId, input);
  await r.plans.addEntry(foodId, { ...input, meal: 'lunch', quantity: 125, quantity_mode: 'amount' });
  await r.plans.addEntry(foodId, { ...input, meal: 'dinner', quantity: 2 });
  await r.plans.addEntry(foodId, { ...input, meal: 'snacks', quantity: 0.5 });
  await r.plans.addEntry(foodId, { ...input, date: '2026-10-21' });
  assert.deepEqual(dailyTotals(await r.plans.listDay(input.date)), { total: 900, byMeal: { breakfast: 300, lunch: 100, dinner: 400, snacks: 100 } });
  assert.equal((await r.dashboard.getDay(input.date)).totals.total, 0);
  assert.equal((await r.diary.listDay(input.date)).length, 0);
  assert.equal((await r.plans.listDay('2026-10-21')).length, 1);
  await r.plans.update(id, { ...input, quantity: 1 });
  assert.equal((await r.plans.get(id)).total_calories, 200);
  await r.plans.remove(id);
  assert.equal(await r.plans.get(id), null);
  assert.equal(notifications, 7);
  await assert.rejects(r.plans.addEntry(foodId, { ...input, quantity: 0 }));
  await assert.rejects(r.plans.addEntry(foodId, { ...input, date: '2026-02-30' }));
  await assert.rejects(r.plans.addEntry('missing', input), /not found/);
  await assert.rejects(r.plans.update('missing', input), /not found/);
  await assert.rejects(r.plans.remove('missing'), /not found/);
  assert.equal(notifications, 7);
});

test('copying preserves quantities and historical snapshots, resets eaten state, uses fresh IDs and prevents duplicate day copies', async (t) => {
  const { r, foodId } = await fixture(t);
  const id = await r.plans.addEntry(foodId, input);
  await r.plans.markEaten(id, today);
  await r.foods.updateCustom(foodId, { ...food, name: 'Changed catalog', calories: 999, notes: 'New note' });
  await r.foods.remove(foodId);
  const original = await r.plans.get(id);
  const destination = '2026-10-22';
  assert.equal(await r.plans.copyDay(input.date, destination), 1);
  const [copy] = await r.plans.listDay(destination);
  assert.notEqual(copy.id, id); assert.equal(copy.entry_date, destination);
  for (const key of ['name', 'serving_amount', 'serving_unit', 'calories', 'quantity', 'quantity_mode', 'meal', 'protein', 'notes', 'total_calories']) assert.equal(copy[key], original[key]);
  assert.equal(copy.food_id, null); assert.equal(copy.eaten_at, null); assert.equal(copy.diary_entry_id, null);
  assert.equal((await r.diary.listDay(today)).length, 1);
  assert.equal((await r.dashboard.getDay(destination)).totals.total, 0);
  await assert.rejects(r.plans.copyDay(input.date, destination), /empty destination/);
  await assert.rejects(r.plans.copyDay(input.date, input.date), /different/);
  await assert.rejects(r.plans.copyDay('2026-10-23', '2026-10-24'), /no plan/);
  assert.equal((await r.plans.listDay(destination)).length, 1);
  await r.plans.update(copy.id, { ...input, date: destination, quantity: 2 });
  assert.equal((await r.plans.get(id)).quantity, 1.5);
});

test('marking eaten is idempotent, retains the original plan and logs its snapshot on the explicit local consumed date', async (t) => {
  const { db, r, foodId } = await fixture(t);
  const id = await r.plans.addEntry(foodId, input);
  await r.foods.updateCustom(foodId, { ...food, calories: 999 });
  const result = await r.plans.markEaten(id, today);
  assert.equal(result.created, true);
  assert.deepEqual(await r.plans.markEaten(id, today), { ...result, created: false });
  const entry = await r.diary.get(result.entryId);
  assert.equal(entry.total_calories, 300); assert.equal(entry.protein, null); assert.equal(entry.notes, food.notes);
  assert.equal(entry.entry_date, today); assert.equal(entry.meal, input.meal); assert.equal(entry.quantity, 1.5);
  const plan = await r.plans.get(id);
  assert.equal(plan.entry_date, input.date); assert.equal(plan.quantity, input.quantity); assert.equal(plan.eaten_date, today);
  assert.equal((await r.dashboard.getDay(today)).totals.total, 300);
  assert.equal((await r.dashboard.getDay(input.date)).totals.total, 0);
  await assert.rejects(r.plans.update(id, { ...input, quantity: 2 }), /read-only/);
  await assert.rejects(r.plans.remove(id), /history/);
  await r.diary.update(entry.id, { date: today, meal: 'lunch', quantity: 2, quantity_mode: 'servings' });
  assert.equal((await r.plans.get(id)).quantity, 1.5);
  await r.diary.remove(entry.id);
  assert.equal((await r.plans.get(id)).diary_entry_id, null);
  assert.deepEqual(await r.plans.markEaten(id, today), { entryId: null, created: false });
  assert.equal((await r.diary.listDay(today)).length, 0);
  await assert.rejects(db.runAsync('DELETE FROM planned_meals WHERE id = ?', id), /history/);
  await assert.rejects(db.runAsync('UPDATE planned_meals SET quantity = 2 WHERE id = ?', id), /read-only/);
  assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'), []);
});

test('whole-meal conversion rolls back all diary inserts and receipts on failure, then retries without double-counting', async (t) => {
  const { db, r, foodId } = await fixture(t);
  const first = await r.plans.addEntry(foodId, input);
  const secondFood = await r.foods.createCustom({ ...food, name: 'Second food' });
  const second = await r.plans.addEntry(secondFood, { ...input, quantity: 1 });
  await r.plans.addEntry(foodId, { ...input, meal: 'lunch' });
  await db.execAsync("CREATE TRIGGER fail_meal BEFORE INSERT ON diary_entries WHEN new.name = 'Second food' BEGIN SELECT RAISE(ABORT, 'Injected failure'); END;");
  let notifications = 0; r.subscribe(() => { notifications++; });
  await assert.rejects(r.plans.markMealEaten(input.date, 'breakfast', today), /Injected failure/);
  assert.equal((await r.diary.listDay(today)).length, 0);
  assert.equal((await r.plans.get(first)).eaten_at, null); assert.equal((await r.plans.get(second)).eaten_at, null);
  assert.equal(notifications, 0);
  await db.execAsync('DROP TRIGGER fail_meal');
  assert.equal(await r.plans.markMealEaten(input.date, 'breakfast', today), 2);
  assert.equal(await r.plans.markMealEaten(input.date, 'breakfast', today), 0);
  assert.equal((await r.diary.listDay(today)).length, 2);
  assert.equal((await r.dashboard.getDay(today)).totals.total, 500);
  assert.equal((await r.plans.listDay(input.date)).filter((plan) => plan.eaten_at).length, 2);
  await r.plans.addEntry(foodId, { ...input, quantity: 0.5 });
  assert.equal(await r.plans.markMealEaten(input.date, 'breakfast', today), 1);
  assert.equal((await r.dashboard.getDay(today)).totals.total, 600);
  await assert.rejects(r.plans.markMealEaten(input.date, 'dinner', today), /no planned/);
  await assert.rejects(r.plans.markEaten(first, '2099-01-01'), /future date/);
  await assert.rejects(r.plans.markEaten('missing', today), /not found/);
});

test('copying a day is transactional and never leaves a partial destination', async (t) => {
  const { db, r, foodId } = await fixture(t);
  await r.plans.addEntry(foodId, input);
  const second = await r.foods.createCustom({ ...food, name: 'Second food' });
  await r.plans.addEntry(second, input);
  await db.execAsync("CREATE TRIGGER fail_copy BEFORE INSERT ON planned_meals WHEN new.entry_date = '2026-10-22' AND new.name = 'Second food' BEGIN SELECT RAISE(ABORT, 'Injected copy failure'); END;");
  await assert.rejects(r.plans.copyDay(input.date, '2026-10-22'), /Injected copy failure/);
  assert.equal((await r.plans.listDay('2026-10-22')).length, 0);
  assert.equal((await r.plans.listDay(input.date)).length, 2);
  await db.execAsync('DROP TRIGGER fail_copy');
  assert.equal(await r.plans.copyDay(input.date, '2026-10-22'), 2);
});

test('migration 5 preserves legacy plan IDs, gram snapshots and local dates; interrupted upgrades roll back', async (t) => {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  const db = adapt(sqlite);
  for (const migration of migrations.slice(0, 4)) await db.execAsync(migration.sql);
  await db.execAsync('PRAGMA user_version = 4');
  const r = createRepositories(db, randomUUID, now);
  const profileId = await r.profiles.save({ name: 'Legacy user' });
  const foodId = await r.foods.createCustom(food);
  const at = '2026-10-19T23:30:00.000Z';
  await db.runAsync('INSERT INTO planned_meals VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 'legacy-plan', profileId, foodId, 'Historical plan', 100, null, 20, 4, 50, at, now());
  const original = db.execAsync;
  db.execAsync = async (sql) => { await original(sql); if (sql.includes('CREATE TABLE plans_v5')) throw new Error('Interrupted plan upgrade'); };
  await assert.rejects(initializeDatabase(db), /Interrupted/);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 4);
  assert.equal((await db.getFirstAsync('SELECT name FROM planned_meals')).name, 'Historical plan');
  db.execAsync = original; await initializeDatabase(db);
  const plan = await r.plans.get('legacy-plan');
  assert.equal(plan.food_id, foodId); assert.equal(plan.entry_date, localCalendarDate(new Date(at)));
  assert.equal(plan.name, 'Historical plan'); assert.equal(plan.serving_amount, 100); assert.equal(plan.serving_unit, 'g');
  assert.equal(plan.quantity, 50); assert.equal(plan.quantity_mode, 'amount'); assert.equal(plan.total_calories, 50);
  assert.equal(plan.protein, null); assert.equal(plan.meal, 'snacks'); assert.equal(plan.eaten_at, null);
  await initializeDatabase(db);
  assert.equal((await r.plans.listDay(plan.entry_date)).length, 1);
  assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'), []);
});

test('plans and eaten receipts persist across database reopen and still prevent repeated logging', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'calories-plans-')); let sqlite;
  try {
    const path = join(directory, 'plans.db');
    sqlite = new DatabaseSync(path); let db = adapt(sqlite); await initializeDatabase(db);
    let r = createRepositories(db, randomUUID, now);
    const foodId = await r.foods.createCustom(food);
    const id = await r.plans.addEntry(foodId, input);
    const receipt = await r.plans.markEaten(id, today);
    sqlite.close(); sqlite = new DatabaseSync(path); db = adapt(sqlite); await initializeDatabase(db);
    r = createRepositories(db, randomUUID, now);
    assert.equal((await r.plans.get(id)).diary_entry_id, receipt.entryId);
    assert.equal((await r.plans.markEaten(id, today)).created, false);
    assert.equal((await r.diary.listDay(today)).length, 1);
    assert.equal(dailyTotals(await r.plans.listDay(input.date)).total, 300);
  } finally { sqlite?.close(); rmSync(directory, { recursive: true, force: true }); }
});
