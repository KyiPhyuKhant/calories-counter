import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { initializeDatabase, migrations } from '../src/data/migrations.ts';
import { createRepositories } from '../src/data/repositories.ts';
import { DuplicateFoodError } from '../src/data/foodRepository.ts';
import { cuisines, validateFood } from '../src/domain/food.ts';
import { adapt } from './sqlite.mjs';
import { renderModule } from './helpers/renderUI.mjs';

// Synthetic test nutrition, not a nutritional source or bundled dish dataset.
const food = { name: 'Test food', calories: 200, serving_amount: 100, serving_unit: 'g' };
async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  const db = adapt(sqlite); await initializeDatabase(db);
  return { db, r: createRepositories(db, randomUUID) };
}

test('cuisine validation accepts four supported categories or no category and rejects arbitrary SQL input', async (t) => {
  const { db, r } = await fixture(t);
  for (const cuisine of [null, undefined, ...cuisines]) assert.deepEqual(validateFood({ ...food, cuisine }), {});
  for (const cuisine of ['', 'Japanese', 'other', "japanese' OR 1=1 --", 1]) {
    assert.ok(validateFood({ ...food, cuisine }).cuisine);
    await assert.rejects(r.foods.createCustom({ ...food, cuisine }), /cuisine/);
    await assert.rejects(r.foods.search('', 50, 0, cuisine), /cuisine/);
  }
  const id = await r.foods.createCustom(food);
  await assert.rejects(db.runAsync('UPDATE foods SET cuisine = ? WHERE id = ?', 'unsupported', id), /CHECK/);
});

test('offline cuisine filters combine with name search, preserve uncategorized foods in All, and paginate deterministically', async (t) => {
  const { r } = await fixture(t);
  const ids = new Map();
  for (const cuisine of cuisines) ids.set(cuisine, await r.foods.createCustom({ ...food, name: `${cuisine} test food`, cuisine }));
  const uncategorized = await r.foods.createCustom(food);
  for (const cuisine of cuisines) {
    assert.deepEqual((await r.foods.search('', 50, 0, cuisine)).map(({ id }) => id), [ids.get(cuisine)]);
    assert.deepEqual((await r.foods.search('test', 50, 0, cuisine)).map(({ id }) => id), [ids.get(cuisine)]);
    assert.deepEqual(await r.foods.search('nomatch', 50, 0, cuisine), []);
  }
  assert.ok((await r.foods.search('test')).some(({ id }) => id === uncategorized));
  assert.equal((await r.foods.search('demo')).length, 4);
  for (const name of ['Page A', 'Page B', 'Page C']) await r.foods.createCustom({ ...food, name, cuisine: 'japanese' });
  const first = await r.foods.search('page', 2, 0, 'japanese');
  const next = await r.foods.search('page', 2, 2, 'japanese');
  assert.deepEqual([...first, ...next].map(({ name }) => name), ['Page A', 'Page B', 'Page C']);
  assert.equal(new Set([...first, ...next].map(({ id }) => id)).size, 3);
  assert.equal((await r.foods.search('', 1, 1, 'japanese')).length, 1);
});

test('existing native-script name search still works with cuisine filters', async (t) => {
  const { r } = await fixture(t);
  for (const [cuisine, name, query] of [
    ['myanmar', 'မုန့်ဟင်းခါး', 'မုန့်ဟင်းခါး'],
    ['japanese', '玄米ごはん', '玄米'],
    ['chinese', '炒饭', '炒饭'],
    ['western', 'Crème yogurt', 'creme'],
  ]) {
    const id = await r.foods.createCustom({ ...food, name, cuisine });
    assert.deepEqual((await r.foods.search(query, 50, 0, cuisine)).map(({ id }) => id), [id]);
    assert.deepEqual(await r.foods.search(query, 50, 0, cuisine === 'western' ? 'japanese' : 'western'), []);
  }
});

test('custom cuisine edits preserve nutrition and IDs, omitted values retain categories, and explicit null clears them', async (t) => {
  const { r } = await fixture(t);
  const id = await r.foods.createCustom({ ...food, cuisine: 'myanmar' });
  const profileId = await r.profiles.save({ name: 'Test user' });
  await r.diary.addEntry(id, { date: '2026-10-15', meal: 'lunch', quantity: 1, quantity_mode: 'servings' });
  const snapshot = (await r.diary.list(profileId))[0];
  await r.foods.updateCustom(id, { ...food, cuisine: 'chinese' });
  assert.equal((await r.foods.get(id)).cuisine, 'chinese');
  assert.deepEqual(await r.foods.search('', 50, 0, 'myanmar'), []);
  await r.foods.updateCustom(id, food);
  assert.equal((await r.foods.get(id)).cuisine, 'chinese');
  await r.foods.update(id, { name: food.name, calories_per_100g: 200, protein_per_100g: null, carbs_per_100g: null, fat_per_100g: null });
  assert.equal((await r.foods.get(id)).cuisine, 'chinese');
  assert.deepEqual((await r.diary.list(profileId))[0], snapshot);
  await assert.rejects(r.foods.createCustom({ ...food, cuisine: 'western' }), DuplicateFoodError);
  await r.foods.updateCustom(id, { ...food, cuisine: null });
  assert.equal((await r.foods.get(id)).cuisine, null);
  assert.equal((await r.foods.get(id)).calories, food.calories);
  await r.foods.remove(id);
  assert.equal(await r.foods.get(id), null);
});

test('cached external cuisine persists on refresh without category and provider deduplication still applies', async (t) => {
  const { r } = await fixture(t);
  const id = await r.foods.saveExternal('test', 'fixture-1', { ...food, cuisine: 'japanese' });
  assert.equal(await r.foods.saveExternal('test', 'fixture-1', food), id);
  assert.equal((await r.foods.get(id)).cuisine, 'japanese');
  assert.deepEqual((await r.foods.search('', 50, 0, 'japanese')).map(({ id }) => id), [id]);
  await r.foods.saveExternal('test', 'fixture-1', { ...food, cuisine: null });
  assert.equal((await r.foods.get(id)).cuisine, null);
});

async function versionSix(t) {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  const db = adapt(sqlite);
  for (const migration of migrations.filter(({ version }) => version <= 6)) await db.execAsync(migration.sql);
  await db.execAsync('PRAGMA user_version = 6');
  await db.runAsync(`INSERT INTO foods (id, name, search_key, calories, serving_amount, serving_unit, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 'legacy-food', 'Existing food', 'existing food', 200, 100, 'g', 'custom', 'old', 'old');
  return db;
}

test('migration 7 preserves existing food records without classifying, replacing or reimporting them', async (t) => {
  const db = await versionSix(t);
  const r = createRepositories(db, randomUUID);
  await r.diary.addEntry('legacy-food', { date: '2026-10-15', meal: 'lunch', quantity: 2, quantity_mode: 'servings' });
  await r.plans.addEntry('legacy-food', { date: '2026-10-16', meal: 'dinner', quantity: 1, quantity_mode: 'servings' });
  const diary = await r.diary.listDay('2026-10-15');
  const plans = await r.plans.listDay('2026-10-16');
  const original = await db.getFirstAsync('SELECT * FROM foods WHERE id = ?', 'legacy-food');
  await initializeDatabase(db); await initializeDatabase(db);
  const saved = await db.getFirstAsync('SELECT * FROM foods WHERE id = ?', 'legacy-food');
  assert.deepEqual({ ...saved }, { ...original, cuisine: null });
  assert.deepEqual(await r.diary.listDay('2026-10-15'), diary);
  assert.deepEqual(await r.plans.listDay('2026-10-16'), plans);
  assert.equal((await db.getFirstAsync('SELECT count(*) AS count FROM foods')).count, 1);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 7);
  assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'), []);
  assert.equal((await createRepositories(db, randomUUID).foods.search('existing'))[0].id, 'legacy-food');
  const plan = await db.getAllAsync('EXPLAIN QUERY PLAN SELECT * FROM foods WHERE cuisine = ? ORDER BY name COLLATE NOCASE, id LIMIT ? OFFSET ?', 'myanmar', 50, 0);
  assert.ok(plan.some(({ detail }) => detail.includes('foods_cuisine_name_idx')));
});

test('an interrupted cuisine migration rolls back the column, index and version and can retry', async (t) => {
  const db = await versionSix(t); const exec = db.execAsync;
  db.execAsync = async (sql) => { await exec(sql); if (sql.includes('ADD COLUMN cuisine')) throw new Error('Interrupted cuisine upgrade'); };
  await assert.rejects(initializeDatabase(db), /Interrupted/);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 6);
  assert.equal((await db.getAllAsync('PRAGMA table_info(foods)')).some(({ name }) => name === 'cuisine'), false);
  assert.equal((await db.getFirstAsync('SELECT count(*) AS count FROM foods')).count, 1);
  assert.equal((await db.getFirstAsync('PRAGMA foreign_keys')).foreign_keys, 1);
  db.execAsync = exec; await initializeDatabase(db);
  assert.equal((await db.getFirstAsync('SELECT cuisine FROM foods WHERE id = ?', 'legacy-food')).cuisine, null);
});

test('cuisine picker labels distinguish filtering from uncategorized custom-food editing and expose disabled state', () => {
  for (const [value, emptyLabel, expected] of [[null, undefined, 'All cuisines'], ['myanmar', undefined, 'Myanmar'], [null, 'Unspecified cuisine', 'Unspecified cuisine']]) {
    const { nodes } = renderModule('src/components/CuisinePicker.tsx', 'CuisinePicker', { value, emptyLabel, onChange() {}, disabled: true });
    const button = nodes.find(({ type }) => type === 'Pressable').props;
    assert.equal(button.accessibilityLabel, `Cuisine: ${expected}`);
    assert.equal(button.accessibilityState.disabled, true); assert.equal(button.disabled, true);
  }
});
