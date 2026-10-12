import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { calorieProgress, summarizeDashboard } from '../src/domain/dashboard.ts';
import { calculateCalorieGoal } from '../src/domain/calorieGoal.ts';
import { createRepositories } from '../src/data/repositories.ts';
import { initializeDatabase } from '../src/data/migrations.ts';
import { adapt } from './sqlite.mjs';

const profile = { sex: 'male', age: 30, height_cm: 180, current_weight_kg: 80, target_weight_kg: 80, activity_level: 'sedentary', goal: 'maintain', manual_calorie_target: 2100 };
const input = { date: '2026-10-13', meal: 'breakfast', quantity: 1, quantity_mode: 'servings' };

test('under, exact and over-target progress uses signed remaining and caps the indicator', () => {
  assert.deepEqual(calorieProgress(2000, 1500), { target: 2000, consumed: 1500, remaining: 500, over: 0, state: 'remaining', fraction: 0.75 });
  assert.deepEqual(calorieProgress(2000, 2000), { target: 2000, consumed: 2000, remaining: 0, over: 0, state: 'reached', fraction: 1 });
  assert.deepEqual(calorieProgress(2000, 2500), { target: 2000, consumed: 2500, remaining: -500, over: 500, state: 'over', fraction: 1 });
  assert.equal(calorieProgress(2000, 0).fraction, 0);
  assert.equal(calorieProgress(2000, 2000.01).state, 'over');
  assert.equal(calorieProgress(2000, 1999.99).state, 'remaining');
  for (const target of [0, -1, NaN, Infinity]) assert.throws(() => calorieProgress(target, 0));
  for (const consumed of [-1, NaN, Infinity]) assert.throws(() => calorieProgress(2000, consumed));
});

test('no target is invented for missing, incomplete or invalid profiles; saved manual and calculated targets are respected', () => {
  assert.equal(summarizeDashboard(null, []).progress, null);
  assert.equal(summarizeDashboard({ ...profile, height_cm: null }, []).progress, null);
  assert.equal(summarizeDashboard({ ...profile, age: 10 }, []).progress, null);
  assert.equal(summarizeDashboard(profile, []).progress.target, 2100);
  const automatic = { ...profile, manual_calorie_target: null };
  assert.equal(summarizeDashboard(automatic, []).progress.target, calculateCalorieGoal(automatic).target);
});

test('persisted dashboard excludes plans and other dates, and committed mutations notify subscribers', async (t) => {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  const db = adapt(sqlite); await initializeDatabase(db);
  let inTransaction = false;
  const transaction = db.withExclusiveTransactionAsync.bind(db);
  db.withExclusiveTransactionAsync = async (task) => {
    inTransaction = true;
    try { return await transaction(task); } finally { inTransaction = false; }
  };
  const r = createRepositories(db, randomUUID);
  assert.equal((await r.dashboard.getDay(input.date)).progress, null);
  let notifications = 0;
  let notifiedBeforeCommit = false;
  const unsubscribe = r.subscribe(() => { notifications++; notifiedBeforeCommit ||= inTransaction; });
  const profileId = await r.profiles.saveCalorieProfile(profile);
  const foodId = await r.foods.createCustom({ name: 'Dashboard test food', calories: 500, serving_amount: 1, serving_unit: 'piece', protein: null, carbohydrates: null, fat: null, notes: null });
  const id = await r.diary.addEntry(foodId, input);
  let day = await r.dashboard.getDay(input.date);
  assert.equal(notifications, 2);
  assert.equal(day.progress.remaining, 1600); assert.equal(day.totals.byMeal.breakfast, 500);
  // A mass-based planned food is needed by the legacy planning repository.
  const plannedId = await r.foods.createCustom({ name: 'Planned test food', calories: 300, serving_amount: 100, serving_unit: 'g', protein: null, carbohydrates: null, fat: null, notes: null });
  await r.plans.add(profileId, plannedId, 100, '2026-10-14T12:00:00Z');
  await r.plans.add(profileId, plannedId, 100, '2026-10-13T12:00:00Z');
  await r.diary.addEntry(foodId, { ...input, date: '2026-10-14' });
  assert.equal((await r.dashboard.getDay(input.date)).totals.total, 500);
  await r.diary.update(id, { ...input, quantity: 4.2, meal: 'lunch' });
  day = await r.dashboard.getDay(input.date);
  assert.equal(day.progress.state, 'reached'); assert.equal(day.totals.byMeal.breakfast, 0); assert.equal(day.totals.byMeal.lunch, 2100);
  await r.diary.update(id, { ...input, quantity: 5 });
  assert.equal((await r.dashboard.getDay(input.date)).progress.over, 400);
  await r.diary.remove(id);
  assert.equal(notifications, 6);
  assert.equal((await r.dashboard.getDay(input.date)).totals.total, 0);
  assert.equal((await r.dashboard.getDay('2026-10-14')).totals.total, 500);
  const beforeFailure = notifications;
  await assert.rejects(r.diary.addEntry('missing', input));
  await assert.rejects(r.diary.update('missing', input));
  await assert.rejects(r.diary.remove('missing'));
  assert.equal(notifications, beforeFailure);
  await r.profiles.saveCalorieProfile({ ...profile, manual_calorie_target: 2200 });
  assert.equal((await r.dashboard.getDay(input.date)).progress.target, 2200);
  assert.equal(notifications, beforeFailure + 1);
  assert.equal(notifiedBeforeCommit, false);
  const reopenedRepositories = createRepositories(db, randomUUID);
  assert.equal((await reopenedRepositories.dashboard.getDay(input.date)).progress.target, 2200);
  unsubscribe();
  await r.diary.addEntry(foodId, input);
  assert.equal((await reopenedRepositories.dashboard.getDay(input.date)).totals.total, 500);
  assert.equal(notifications, beforeFailure + 1);
  await assert.rejects(r.dashboard.getDay('2026-02-30'));
});
