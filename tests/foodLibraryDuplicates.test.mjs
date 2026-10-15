import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { initializeDatabase } from '../src/data/migrations.ts';
import { seedBundledFoodCatalog } from '../src/data/bundledFoodCatalog.ts';
import { createRepositories } from '../src/data/repositories.ts';
import { createSimpleFoodForm, simpleFoodInput } from '../src/screens/simpleFoodForm.ts';
import { adapt } from './sqlite.mjs';

async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  const db = adapt(sqlite); await initializeDatabase(db); await seedBundledFoodCatalog(db);
  const r = createRepositories(db, randomUUID);
  const original = (await r.foods.search('Mohinga'))[0];
  return { db, r, original };
}

test('adding calories shows one personal version in blank, English and Myanmar searches before pagination', async (t) => {
  const { db, r, original } = await fixture(t);
  const input = simpleFoodInput({ ...createSimpleFoodForm(original), calories: '300' }, original);
  const id = await r.foods.createCustom(input);
  for (const cuisine of [null, 'myanmar']) {
    for (const query of ['', 'Mohinga', original.native_name, ...original.aliases]) {
      const all = [...await r.foods.search(query, 100, 0, cuisine), ...await r.foods.search(query, 100, 100, cuisine)];
      assert.ok(all.some((food) => food.id === id));
      assert.ok(!all.some((food) => food.id === original.id));
      const pages = [];
      for (let offset = 0; offset < all.length; offset += 7) pages.push(...await r.foods.search(query, 7, offset, cuisine));
      assert.deepEqual(pages.map((food) => food.id), all.map((food) => food.id));
    }
  }
  assert.deepEqual(await r.foods.get(original.id), original);
  assert.ok((await r.foods.list()).some((food) => food.id === original.id));
  await r.diary.addEntry(id, { date: '2026-10-15', meal: 'lunch', quantity: 1, quantity_mode: 'servings' });
  const snapshot = await r.diary.listDay('2026-10-15');
  await seedBundledFoodCatalog(db);
  assert.deepEqual(await r.diary.listDay('2026-10-15'), snapshot);
  assert.deepEqual((await r.foods.search('Mohinga')).map((food) => food.id), [id]);
  await r.foods.updateCustom(id, { ...input, calories: 350 });
  assert.deepEqual(await r.diary.listDay('2026-10-15'), snapshot);
  await r.foods.remove(id);
  assert.deepEqual((await r.foods.search('Mohinga')).map((food) => food.id), [original.id]);
  assert.equal((await r.diary.listDay('2026-10-15'))[0].total_calories, 300);
});

test('only matching usable custom foods hide placeholders, including valid zero calories', async (t) => {
  const { r, original } = await fixture(t);
  const input = simpleFoodInput(createSimpleFoodForm(original), original);
  const id = await r.foods.createCustom(input);
  assert.equal((await r.foods.search('Mohinga')).length, 2);
  for (const variant of [{ serving_amount: 200 }, { serving_unit: 'serving' }, { cuisine: 'chinese' }]) {
    await r.foods.updateCustom(id, { ...input, calories: 300, ...variant });
    assert.equal((await r.foods.search('Mohinga')).length, 2);
  }
  await r.foods.updateCustom(id, { ...input, calories: 0 });
  assert.deepEqual((await r.foods.search('Mohinga')).map((food) => food.id), [id]);
  await r.foods.updateCustom(id, { ...input, calories: null });
  assert.equal((await r.foods.search('Mohinga')).length, 2);
});

test('uncategorized ingredients use null-safe matching and sourced foods remain distinct', async (t) => {
  const { r } = await fixture(t);
  const original = (await r.foods.search('', 100)).find((food) => food.source === 'bundled' && food.cuisine === null && food.calories === null);
  assert.ok(original);
  const input = { ...simpleFoodInput(createSimpleFoodForm(original), original), calories: 100 };
  const id = await r.foods.createCustom(input);
  const externalId = await r.foods.saveExternal('test', 'fixture', input);
  const found = await r.foods.search(original.name);
  assert.ok(found.some((food) => food.id === id));
  assert.ok(found.some((food) => food.id === externalId));
  assert.ok(!found.some((food) => food.id === original.id));
});
