import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { initializeDatabase } from '../src/data/migrations.ts';
import { createRepositories } from '../src/data/repositories.ts';

// Execute production SQL against real SQLite without loading React Native native modules.
function adapt(sqlite) {
  return {
    async execAsync(sql) { sqlite.exec(sql); },
    async runAsync(sql, ...params) { return sqlite.prepare(sql).run(...params); },
    async getFirstAsync(sql, ...params) { return sqlite.prepare(sql).get(...params) ?? null; },
    async getAllAsync(sql, ...params) { return sqlite.prepare(sql).all(...params); },
    async withExclusiveTransactionAsync(task) {
      sqlite.exec('BEGIN');
      try {
        await task(this);
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  const db = adapt(sqlite);
  await initializeDatabase(db);
  const repositories = createRepositories(db, randomUUID);
  return { sqlite, db, repositories };
}

const food = { name: 'Oats', calories_per_100g: 380, protein_per_100g: 13, carbs_per_100g: 68, fat_per_100g: 7 };
const at = '2026-10-13T08:00:00.000Z';

test('initialization creates all tables, indexes and foreign keys; reruns preserve data', async (t) => {
  const { db, repositories } = await fixture(t);
  const id = await repositories.profiles.save({ name: 'Local user', height_cm: 170 });
  await initializeDatabase(db);
  assert.equal((await repositories.profiles.get()).id, id);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 1);
  assert.equal((await db.getFirstAsync('PRAGMA foreign_keys')).foreign_keys, 1);
  const tables = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'table'");
  assert.deepEqual(tables.map((row) => row.name).sort(),
    ['diary_entries', 'foods', 'planned_meals', 'user_profiles', 'weight_history']);
  const indexes = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL");
  assert.equal(indexes.length, 6);
});

test('failed migrations roll back schema and version, then can retry', async (t) => {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  const db = adapt(sqlite);
  const original = db.execAsync;
  db.execAsync = async (sql) => {
    await original(sql);
    if (sql.includes('CREATE TABLE foods')) throw new Error('Simulated failure');
  };
  await assert.rejects(initializeDatabase(db), /Simulated failure/);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 0);
  assert.equal(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type = 'table'"), null);
  db.execAsync = original;
  await initializeDatabase(db);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 1);
});

test('a future schema is rejected without rewriting its version', async (t) => {
  const { db } = await fixture(t);
  await db.execAsync('PRAGMA user_version = 2');
  await assert.rejects(initializeDatabase(db), /newer version/);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 2);
});

test('profile saves retain one stable ID and food input is parameterized', async (t) => {
  const { repositories: r } = await fixture(t);
  const id = await r.profiles.save({ name: 'First' });
  assert.equal(await r.profiles.save({ name: 'Updated', height_cm: 180 }), id);
  assert.equal((await r.profiles.get()).name, 'Updated');
  const text = "Oats'); DROP TABLE foods; --";
  const foodId = await r.foods.create({ ...food, name: text });
  assert.match(foodId, /^[0-9a-f-]{36}$/);
  assert.equal((await r.foods.get(foodId)).name, text);
  assert.equal((await r.foods.list()).length, 1);
  await assert.rejects(r.foods.update('missing', food), /not found/);
});

test('consumed and planned snapshots survive catalog edits and deletion independently', async (t) => {
  const { repositories: r } = await fixture(t);
  const profile = await r.profiles.save({ name: 'Local user' });
  const foodId = await r.foods.create(food);
  const planId = await r.plans.add(profile, foodId, 100, at);
  assert.equal((await r.diary.list(profile)).length, 0);
  const diaryId = await r.diary.add(profile, foodId, 50, at);
  await r.foods.update(foodId, { ...food, name: 'Changed', calories_per_100g: 900 });
  const entry = (await r.diary.list(profile))[0];
  assert.equal(entry.name, 'Oats');
  assert.equal(entry.calories_per_100g, 380);
  assert.equal(entry.protein_per_100g, 13);
  assert.equal(entry.carbs_per_100g, 68);
  assert.equal(entry.fat_per_100g, 7);
  assert.equal(entry.amount_g, 50);
  await r.foods.remove(foodId);
  assert.equal((await r.diary.list(profile))[0].food_id, null);
  assert.equal((await r.plans.list(profile))[0].name, 'Oats');
  assert.equal((await r.plans.list(profile))[0].food_id, null);
  await r.plans.remove(planId);
  assert.equal((await r.diary.list(profile)).length, 1);
  await r.diary.remove(diaryId);
  assert.equal((await r.diary.list(profile)).length, 0);
});

test('foreign keys and constraints reject invalid records; repositories validate numbers and time', async (t) => {
  const { db, repositories: r } = await fixture(t);
  const profile = await r.profiles.save({ name: 'User' });
  const foodId = await r.foods.create(food);
  await assert.rejects(r.diary.add('missing', foodId, 50, at), /FOREIGN KEY/);
  await assert.rejects(r.plans.add(profile, 'missing', 50, at), /Food not found/);
  await assert.rejects(r.weights.add('missing', 70, at), /FOREIGN KEY/);
  await assert.rejects(r.foods.create({ ...food, fat_per_100g: -1 }), /nonnegative/);
  await assert.rejects(r.diary.add(profile, foodId, NaN, at), /finite/);
  await assert.rejects(r.weights.add(profile, 70, 'invalid'), /timestamp/);
  await assert.rejects(db.runAsync('UPDATE foods SET calories_per_100g = -1 WHERE id = ?', foodId), /CHECK/);
  await r.diary.add(profile, foodId, 50, at);
  await assert.rejects(db.runAsync('DELETE FROM user_profiles WHERE id = ?', profile), /FOREIGN KEY/);
});

test('weight history is ordered and removable', async (t) => {
  const { repositories: r } = await fixture(t);
  const profile = await r.profiles.save({ name: 'User' });
  const old = await r.weights.add(profile, 70, '2026-10-12T08:00:00Z');
  const recent = await r.weights.add(profile, 69, at);
  assert.deepEqual((await r.weights.list(profile)).map((row) => row.id), [recent, old]);
  await r.weights.remove(old);
  assert.equal((await r.weights.list(profile)).length, 1);
});

test('data persists after closing and reopening a local database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'calories-db-'));
  let sqlite;
  try {
    const path = join(directory, 'test.db');
    sqlite = new DatabaseSync(path);
    let db = adapt(sqlite);
    await initializeDatabase(db);
    const id = await createRepositories(db, randomUUID).foods.create(food);
    sqlite.close();
    sqlite = new DatabaseSync(path);
    db = adapt(sqlite);
    await initializeDatabase(db);
    assert.equal((await createRepositories(db, randomUUID).foods.get(id)).name, food.name);
  } finally {
    sqlite?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
