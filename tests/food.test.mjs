import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { calculateServing, foodSearchExpression, nutritionPer100g, validateFood } from '../src/domain/food.ts';
import { initializeDatabase, migrations } from '../src/data/migrations.ts';
import { createRepositories } from '../src/data/repositories.ts';
import { DuplicateFoodError } from '../src/data/foodRepository.ts';
import { adapt } from './sqlite.mjs';

const food = { name: 'Homemade oats', calories: 200, serving_amount: 50, serving_unit: 'g', protein: 6, carbohydrates: 30, fat: 4, notes: 'Test recipe' };
async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  const db = adapt(sqlite); await initializeDatabase(db);
  return { db, r: createRepositories(db, randomUUID) };
}

test('serving calculations scale nutrients and convert mass units precisely', () => {
  assert.deepEqual(calculateServing(food, 25), { calories: 100, protein: 3, carbohydrates: 15, fat: 2 });
  assert.equal(calculateServing(food, 0.1, 'kg').calories, 400);
  assert.ok(Math.abs(calculateServing(food, 1, 'oz').calories - 113.3980925) < 1e-8);
  assert.equal(nutritionPer100g(food).calories, 400);
  const volume = { ...food, serving_amount: 250, serving_unit: 'ml', protein: null };
  assert.equal(calculateServing(volume, 125).protein, null);
  assert.equal(calculateServing(volume, 125).calories, 100);
  assert.equal(nutritionPer100g(volume), null);
  assert.throws(() => calculateServing(volume, 100, 'g'), /conversion/);
  assert.equal(calculateServing({ ...food, serving_amount: 1, serving_unit: 'piece' }, 2).calories, 400);
  for (const amount of [0, -1, NaN, Infinity, 100001]) assert.throws(() => calculateServing(food, amount));
});

test('food validation distinguishes missing macros from zero and rejects invalid inputs', () => {
  assert.deepEqual(validateFood({ ...food, calories: 0, protein: null, carbohydrates: undefined }), {});
  for (const [key, value] of [['name', ' '], ['calories', -1], ['calories', NaN], ['serving_amount', 0],
    ['serving_amount', 0.00001], ['serving_unit', 'invalid'], ['protein', Infinity], ['fat', -1], ['notes', 'x'.repeat(2001)]]) {
    assert.ok(validateFood({ ...food, [key]: value })[key]);
  }
  assert.equal(calculateServing({ ...food, protein: null }, 50).protein, null);
  assert.equal(calculateServing({ ...food, protein: 0 }, 50).protein, 0);
});

test('bundled development data is labeled, idempotent and protected from edits', async (t) => {
  const { db, r } = await fixture(t);
  await initializeDatabase(db);
  const result = await r.foods.search('demo');
  assert.equal(result.length, 4);
  assert.ok(result.every((item) => item.source === 'bundled' && item.notes.includes('invented') && item.notes.includes('not verified')));
  await assert.rejects(r.foods.updateCustom(result[0].id, food), /Custom food not found/);
  await assert.rejects(r.foods.remove(result[0].id), /Custom food not found/);
});

test('offline FTS search handles prefix tokens, accents, Unicode, punctuation, and pagination', async (t) => {
  const { r } = await fixture(t);
  const id = await r.foods.createCustom(food);
  await r.foods.createCustom({ ...food, name: 'Crème yogurt' });
  await r.foods.createCustom({ ...food, name: '玄米ごはん' });
  await r.foods.createCustom({ ...food, name: "Chef's 100% oats" });
  assert.equal((await r.foods.search('HOMEMADE oa'))[0].id, id);
  assert.equal((await r.foods.search('creme'))[0].name, 'Crème yogurt');
  assert.equal((await r.foods.search('玄米'))[0].name, '玄米ごはん');
  assert.equal((await r.foods.search("Chef's 100%"))[0].name, "Chef's 100% oats");
  assert.deepEqual(await r.foods.search('" OR * --'), []);
  assert.deepEqual(await r.foods.search('***'), []);
  const first = await r.foods.search('', 2, 0);
  const next = await r.foods.search('', 2, 2);
  assert.equal(new Set([...first, ...next].map((item) => item.id)).size, 4);
  assert.equal(foodSearchExpression('oats OR milk'), '"oats"* AND "OR"* AND "milk"*');
  await assert.rejects(r.foods.search('x'.repeat(121)), /120/);
  await assert.rejects(r.foods.search('', 0), /page/);
});

test('custom CRUD updates search, stores unknown macros, and prevents equivalent duplicates', async (t) => {
  const { r } = await fixture(t);
  const id = await r.foods.createCustom({ ...food, protein: undefined });
  assert.equal((await r.foods.get(id)).protein, null);
  assert.equal((await r.foods.get(id)).protein_per_100g, null);
  assert.equal((await r.foods.get(id)).calories_per_100g, 400);
  await assert.rejects(r.foods.createCustom({ ...food, name: '  HOMEMADE   OATS ' }), DuplicateFoodError);
  const second = await r.foods.createCustom({ ...food, name: 'Another food' });
  await assert.rejects(r.foods.updateCustom(second, food), DuplicateFoodError);
  await r.foods.updateCustom(id, { ...food, name: 'My rice', serving_amount: 1, serving_unit: 'cup' });
  assert.equal((await r.foods.search('homemade')).length, 0);
  assert.equal((await r.foods.search('my rice'))[0].id, id);
  assert.equal((await r.foods.get(id)).calories_per_100g, null);
  await r.foods.remove(id);
  assert.equal(await r.foods.get(id), null);
  assert.equal((await r.foods.search('my rice')).length, 0);
});

test('external saves deduplicate provider IDs, retain stable IDs and remain searchable offline', async (t) => {
  const { r } = await fixture(t);
  const id = await r.foods.saveExternal('USDA', 'test-id', food);
  assert.equal(await r.foods.saveExternal('usda', 'test-id', { ...food, calories: 210 }), id);
  const saved = await r.foods.get(id);
  assert.equal(saved.source, 'external'); assert.equal(saved.external_id, 'test-id'); assert.equal(saved.calories, 210);
  assert.notEqual(await r.foods.saveExternal('other', 'test-id', food), id);
  assert.equal((await r.foods.search('homemade')).length, 2);
  await assert.rejects(r.foods.saveExternal('', 'id', food), /required/);
  await assert.rejects(r.foods.remove(id), /Custom food/);
});

test('custom deletion preserves diary snapshots and unknown macros; non-mass food is never treated as grams', async (t) => {
  const { r } = await fixture(t);
  const profile = await r.profiles.save({ name: 'User' });
  const id = await r.foods.createCustom({ ...food, protein: null });
  await r.diary.add(profile, id, 25, '2026-10-13T00:00:00Z');
  await r.foods.updateCustom(id, { ...food, calories: 500 });
  await r.foods.remove(id);
  const entry = (await r.diary.list(profile))[0];
  assert.equal(entry.food_id, null); assert.equal(entry.calories_per_100g, 400); assert.equal(entry.protein_per_100g, null);
  const cup = await r.foods.createCustom({ ...food, serving_amount: 1, serving_unit: 'cup' });
  await assert.rejects(r.diary.add(profile, cup, 100, '2026-10-13T00:00:00Z'), /gram conversion/);
});

test('migration 3 preserves legacy duplicates, food links and snapshots; failed rebuild can retry', async (t) => {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  const db = adapt(sqlite);
  await db.execAsync(migrations[0].sql); await db.execAsync(migrations[1].sql); await db.execAsync('PRAGMA user_version = 2');
  await db.runAsync('INSERT INTO user_profiles (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', 'p', 'User', 'old', 'old');
  for (const id of ['a', 'b']) await db.runAsync('INSERT INTO foods VALUES (?, ?, ?, ?, ?, ?, ?, ?)', id, 'Legacy oats', 200, 5, 30, 4, 'old', 'old');
  await db.runAsync('INSERT INTO diary_entries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 'diary', 'p', 'a', 'Historical oats', 100, 1, 2, 3, 50, '2026-10-13T08:00:00.000Z', 'old');
  await db.runAsync('INSERT INTO planned_meals VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 'plan', 'p', 'b', 'Planned oats', 120, 2, 3, 4, 60, 'old', 'old');
  const original = db.execAsync;
  db.execAsync = async (sql) => { await original(sql); if (sql.includes('CREATE TABLE foods_new')) throw new Error('Interrupted rebuild'); };
  await assert.rejects(initializeDatabase(db), /Interrupted/);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 2);
  assert.equal((await db.getFirstAsync('PRAGMA foreign_keys')).foreign_keys, 1);
  assert.equal((await db.getFirstAsync('SELECT food_id FROM diary_entries')).food_id, 'a');
  db.execAsync = original; await initializeDatabase(db);
  const r = createRepositories(db, randomUUID);
  assert.equal((await r.foods.search('legacy')).length, 2);
  assert.equal((await r.diary.list('p'))[0].food_id, 'a');
  assert.equal((await r.diary.list('p'))[0].calories_per_100g, 100);
  assert.equal((await r.plans.list('p'))[0].food_id, 'b');
  await assert.rejects(r.foods.createCustom({ ...food, name: 'Legacy oats', serving_amount: 100 }), DuplicateFoodError);
  await r.foods.remove('a');
  await assert.rejects(r.foods.createCustom({ ...food, name: 'Legacy oats', serving_amount: 100 }), DuplicateFoodError);
  assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'), []);
});
