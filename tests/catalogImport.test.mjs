import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { bundledFoodCatalog, seedBundledFoodCatalog } from '../src/data/bundledFoodCatalog.ts';
import { importFoodCatalog, parseFoodCatalog } from '../src/data/importFoodCatalog.ts';
import { initializeDatabase, migrations } from '../src/data/migrations.ts';
import { createRepositories } from '../src/data/repositories.ts';
import { adapt } from './sqlite.mjs';
import { calculateServing, hasKnownCalories, validateFood } from '../src/domain/food.ts';
import { calculateRecipeNutrition } from '../src/domain/recipe.ts';
import { foodImage } from '../src/data/foodImages.ts';
import { renderUI } from './helpers/renderUI.mjs';

// Synthetic test nutrition is not part of the bundled food catalog.
const known = { name: 'Synthetic ingredient', calories: 200, serving_amount: 100, serving_unit: 'g', protein: 10, carbohydrates: 30, fat: 4 };
const input = { date: '2026-10-15', meal: 'lunch', quantity: 1, quantity_mode: 'servings' };
async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  const db = adapt(sqlite); await initializeDatabase(db);
  return { db, r: createRepositories(db, randomUUID, () => '2026-10-15T12:00:00Z') };
}
const manifest = (foods) => ({ schema_version: 1, foods });
const first = bundledFoodCatalog.foods[0];

test('Myanmar and Japanese stages each contain the 30 supplied dishes with native names', () => {
  for (const cuisine of ['myanmar', 'japanese']) {
    const foods = bundledFoodCatalog.foods.filter((food) => food.cuisine === cuisine);
    assert.equal(foods.length, 30); assert.ok(foods.every((food) => food.native_name && food.category === 'dish'));
  }
});

test('Western stage retains 30 supplied dishes, optional native names, and unregistered local image references', () => {
  const foods = bundledFoodCatalog.foods.filter((food) => food.cuisine === 'western');
  assert.equal(foods.length, 30); assert.ok(foods.every((food) => food.native_name === null));
  assert.equal(foods.find((food) => food.name === 'Oatmeal').image, 'oatmeal.png');
  assert.equal(foodImage('oatmeal.png'), undefined);
});

test('Chinese stage adds 30 supplied native-name dishes and keeps their stable IDs distinct', () => {
  const foods = bundledFoodCatalog.foods.filter((food) => food.cuisine === 'chinese');
  assert.equal(foods.length, 30); assert.ok(foods.every((food) => food.native_name && food.id.startsWith('catalog:chinese:')));
  assert.ok(foods.some((food) => food.name === 'Mapo Tofu'));
  assert.ok(foods.some((food) => food.name === 'Peking Duck'));
});

test('bundled manifest validates unique stable IDs and never substitutes invented nutrition', () => {
  const foods = parseFoodCatalog(bundledFoodCatalog);
  assert.ok(foods.length >= 30);
  assert.equal(new Set(foods.map(({ id }) => id)).size, foods.length);
  for (const food of foods) {
    assert.equal(food.calories, null); assert.equal(food.protein, null); assert.equal(food.carbohydrates, null); assert.equal(food.fat, null);
    assert.equal(food.nutrition_source, null); assert.equal(food.nutrition_status, 'unverified');
  }
});

test('startup seeding is idempotent and each bundled cuisine is filtered and searchable offline', async (t) => {
  const { db, r } = await fixture(t);
  assert.deepEqual(await seedBundledFoodCatalog(db), { inserted: bundledFoodCatalog.foods.length, skipped: 0 });
  assert.deepEqual(await seedBundledFoodCatalog(db), { inserted: 0, skipped: bundledFoodCatalog.foods.length });
  for (const cuisine of new Set(bundledFoodCatalog.foods.map(({ cuisine }) => cuisine))) {
    const expected = bundledFoodCatalog.foods.filter((food) => food.cuisine === cuisine);
    if (cuisine !== null) {
      const rows = await r.foods.search('', 100, 0, cuisine);
      assert.equal(rows.length, expected.length); assert.ok(rows.length >= 25);
    }
    for (const entry of expected) {
      const saved = await r.foods.get(entry.id);
      assert.equal(saved.native_name, entry.native_name); assert.equal(saved.cuisine, entry.cuisine);
      assert.equal(saved.calories, null); assert.equal(saved.category, entry.category);
      assert.ok((await r.foods.search(entry.name, 100, 0, cuisine)).some(({ id }) => id === entry.id), entry.name);
      if (entry.native_name) assert.ok((await r.foods.search(entry.native_name, 100, 0, cuisine)).some(({ id }) => id === entry.id), entry.native_name);
    }
  }
  assert.equal((await db.getFirstAsync("SELECT count(*) AS n FROM foods WHERE id LIKE 'catalog:%'")).n, bundledFoodCatalog.foods.length);
});

test('import never overwrites a colliding custom ID, existing foods, diary snapshots, plans or eaten receipts', async (t) => {
  const { db, r } = await fixture(t);
  const customId = await r.foods.createCustom(known);
  await db.runAsync('UPDATE foods SET id = ? WHERE id = ?', first.id, customId);
  const custom = await r.foods.get(first.id);
  const entryId = await r.diary.addEntry(first.id, input);
  const planId = await r.plans.addEntry(first.id, input);
  await r.plans.markEaten(planId, input.date);
  const entries = await r.diary.listDay(input.date); const plan = await r.plans.get(planId);
  const result = await seedBundledFoodCatalog(db);
  assert.equal(result.inserted, bundledFoodCatalog.foods.length - 1); assert.equal(result.skipped, 1);
  await seedBundledFoodCatalog(db);
  assert.deepEqual(await r.foods.get(first.id), custom);
  assert.deepEqual(await r.diary.listDay(input.date), entries); assert.deepEqual(await r.plans.get(planId), plan);
  assert.equal((await r.diary.get(entryId)).total_calories, 200);
  assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'), []);
});

test('an import write failure rolls back the entire batch and a retry succeeds', async (t) => {
  const { db } = await fixture(t);
  const failedId = bundledFoodCatalog.foods[1].id;
  await db.runAsync('CREATE TABLE seed_failure (id TEXT)');
  await db.runAsync('INSERT INTO seed_failure VALUES (?)', failedId);
  await db.execAsync("CREATE TRIGGER fail_seed BEFORE INSERT ON foods WHEN new.id IN (SELECT id FROM seed_failure) BEGIN SELECT RAISE(ABORT, 'Injected seed failure'); END;");
  await assert.rejects(seedBundledFoodCatalog(db), /Injected seed/);
  assert.equal((await db.getFirstAsync("SELECT count(*) AS n FROM foods WHERE id LIKE 'catalog:%'")).n, 0);
  await db.execAsync('DROP TRIGGER fail_seed');
  assert.equal((await seedBundledFoodCatalog(db)).inserted, bundledFoodCatalog.foods.length);
});

test('invalid and duplicated manifest rows are rejected before inserting anything', async (t) => {
  const { db } = await fixture(t);
  for (const bad of [null, { schema_version: 9, foods: [] }, manifest([first, first]), manifest([first, { ...first, id: 'bad' }]),
    manifest([{ ...first, calories: undefined }]), manifest([{ ...first, aliases: [1] }]), manifest([{ ...first, image: '../secret.png' }]), manifest([{ ...first, calories: -1 }])]) {
    await assert.rejects(importFoodCatalog(db, bad));
  }
  assert.equal((await db.getFirstAsync("SELECT count(*) AS n FROM foods WHERE id LIKE 'catalog:%'")).n, 0);
});

test('aliases and native names support romanized, Myanmar, Japanese and Chinese search and stay indexed after edits', async (t) => {
  const { r } = await fixture(t);
  const id = await r.foods.createCustom({ ...known, name: 'Personal noodles', native_name: 'မုန့်ဟင်းခါး', aliases: ['mohinga', 'ラーメン', '炒饭'], cuisine: 'myanmar' });
  for (const query of ['mohinga', 'မုန့်ဟင်းခါး', 'ラーメン', '炒饭', 'ＭＯＨＩＮＧＡ']) assert.equal((await r.foods.search(query, 50, 0, 'myanmar'))[0].id, id);
  assert.deepEqual(await r.foods.search('mohinga', 50, 0, 'japanese'), []);
  await r.foods.updateCustom(id, { ...known, native_name: 'うどん', aliases: ['udon'] });
  assert.deepEqual(await r.foods.search('mohinga'), []); assert.equal((await r.foods.search('udon'))[0].id, id);
  await r.foods.remove(id); assert.deepEqual(await r.foods.search('udon'), []);
});

test('unknown nutrition remains null, while real zero calories remain zero', async (t) => {
  const { r } = await fixture(t);
  assert.deepEqual(validateFood({ ...known, calories: null }), {});
  assert.equal(calculateServing({ ...known, calories: null }, 50).calories, null);
  assert.equal(calculateServing({ ...known, calories: 0 }, 50).calories, 0);
  assert.equal(hasKnownCalories({ calories: null }), false); assert.equal(hasKnownCalories({ calories: 0 }), true);
  const id = await r.foods.createCustom({ ...known, calories: null });
  assert.equal((await r.foods.get(id)).calories_per_100g, null);
  await r.foods.updateCustom(id, { ...known, calories: 0 });
  const entry = await r.diary.addEntry(id, input);
  assert.equal((await r.diary.get(entry)).total_calories, 0);
});

test('unknown foods cannot enter consumed or planned snapshots and failed logging creates no local profile', async (t) => {
  const { db, r } = await fixture(t); await seedBundledFoodCatalog(db);
  await assert.rejects(r.diary.addEntry(first.id, input), /Calories are unavailable/);
  await assert.rejects(r.plans.addEntry(first.id, input), /Calories are unavailable/);
  assert.equal(await r.profiles.get(), null);
  assert.deepEqual(await r.diary.listDay(input.date), []); assert.deepEqual(await r.plans.listDay(input.date), []);
  const profileId = await r.profiles.save({ name: 'Test user' });
  await assert.rejects(r.diary.add(profileId, first.id, 100, '2026-10-15T12:00:00Z'));
  await assert.rejects(r.plans.add(profileId, first.id, 100, '2026-10-15T12:00:00Z'));
  const saved = await r.foods.get(first.id);
  const id = await r.foods.createCustom({ ...saved, calories: 210, nutrition_source: 'User supplied portion measurement', nutrition_status: 'user_entered' });
  await r.diary.addEntry(id, input);
  assert.equal((await r.diary.listDay(input.date))[0].total_calories, 210);
  assert.equal((await r.foods.get(first.id)).calories, null);
});

test('unknown catalog rows render unavailable, not zero, and missing or remote images use no unrelated asset', () => {
  const result = renderUI('FoodListItem', { food: { ...first, source: 'bundled' }, selecting: true, onPress() {} });
  assert.match(result.markup, /Calories unavailable/); assert.doesNotMatch(result.markup, /0 kcal|invented|development sample/);
  assert.ok(result.nodes.find(({ type }) => type === 'Pressable').props.accessibilityLabel.startsWith('View'));
  assert.equal(result.nodes.some(({ type }) => type === 'Image'), false);
  assert.equal(foodImage('nonexistent.png'), undefined); assert.equal(foodImage('https://example.com/food.png'), undefined);
});

test('measured recipe calculations use all ingredient quantities and cooked yield, propagate missing macros and reject unknown calories', () => {
  const ingredients = [{ food: known, amount: 200, unit: 'g' }, { food: { ...known, calories: 100, protein: null }, amount: 100, unit: 'g' }];
  const result = calculateRecipeNutrition(ingredients, { amount: 500, unit: 'g' }, { amount: 100, unit: 'g' });
  assert.equal(result.calories, 100); assert.equal(result.protein, null); assert.ok(Math.abs(result.fat - 2.4) < 1e-10);
  assert.throws(() => calculateRecipeNutrition([{ ...ingredients[0], food: { ...known, calories: null } }], { amount: 500, unit: 'g' }, { amount: 100, unit: 'g' }), /known calories/);
  for (const amount of [0, -1, NaN]) assert.throws(() => calculateRecipeNutrition(ingredients, { amount, unit: 'g' }, { amount: 100, unit: 'g' }));
  assert.throws(() => calculateRecipeNutrition(ingredients, { amount: 500, unit: 'g' }, { amount: 1, unit: 'cup' }), /conversion/);
});

test('catalog, Unicode names and unknown nutrition persist after closing and reopening SQLite', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'calories-catalog-')); let sqlite;
  try {
    const path = join(directory, 'catalog.db'); sqlite = new DatabaseSync(path); let db = adapt(sqlite);
    await initializeDatabase(db); await seedBundledFoodCatalog(db); sqlite.close();
    sqlite = new DatabaseSync(path); db = adapt(sqlite); await initializeDatabase(db);
    assert.equal((await seedBundledFoodCatalog(db)).inserted, 0);
    const r = createRepositories(db, randomUUID); assert.equal((await r.foods.get(first.id)).calories, null);
    assert.equal((await r.foods.search(first.native_name))[0].id, first.id);
  } finally { sqlite?.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('migration 8 preserves version 7 foods, rowids, links, snapshots, targets and eaten receipts; interruption can retry', async (t) => {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close()); const db = adapt(sqlite);
  for (const migration of migrations.filter(({ version }) => version <= 7)) await db.execAsync(migration.sql);
  await db.execAsync('PRAGMA user_version = 7');
  await db.runAsync(`INSERT INTO foods (id, name, search_key, calories, serving_amount, serving_unit, source, created_at, updated_at, cuisine)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 'existing', 'Existing meal', 'existing meal', 200, 100, 'g', 'custom', 'old', 'old', 'myanmar');
  const r = createRepositories(db, randomUUID, () => '2026-10-15T12:00:00Z');
  await r.diary.addEntry('existing', input); const planId = await r.plans.addEntry('existing', input); await r.plans.markEaten(planId, input.date);
  const tables = ['user_profiles', 'diary_entries', 'planned_meals', 'weight_history', 'calorie_target_history'];
  const before = new Map(); for (const table of tables) before.set(table, await db.getAllAsync(`SELECT * FROM ${table}`));
  const foodBefore = await db.getFirstAsync('SELECT rowid, * FROM foods');
  const exec = db.execAsync;
  db.execAsync = async (sql) => { await exec(sql); if (sql.includes('CREATE TABLE foods_v8')) throw new Error('Interrupted catalog migration'); };
  await assert.rejects(initializeDatabase(db), /Interrupted catalog/);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 7);
  assert.deepEqual(await db.getFirstAsync('SELECT rowid, * FROM foods'), foodBefore);
  db.execAsync = exec; await initializeDatabase(db);
  const after = await db.getFirstAsync('SELECT rowid, * FROM foods');
  for (const [key, value] of Object.entries(foodBefore)) assert.deepEqual(after[key], value);
  for (const table of tables) assert.deepEqual(await db.getAllAsync(`SELECT * FROM ${table}`), before.get(table));
  assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'), []);
  assert.equal((await r.foods.search('existing'))[0].id, 'existing');
});
