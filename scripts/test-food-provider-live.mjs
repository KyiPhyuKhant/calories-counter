import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createFoodApi } from '../server/food-api.mjs';
import { createUsdaFoodProvider } from '../src/data/usdaFoodProvider.ts';
import { initializeDatabase } from '../src/data/migrations.ts';
import { createRepositories } from '../src/data/repositories.ts';
import { adapt } from '../tests/sqlite.mjs';

if (!process.env.USDA_API_KEY?.trim()) throw new Error('A valid server-side USDA_API_KEY is required for live verification.');
const server = createFoodApi({ apiKey: process.env.USDA_API_KEY });
const sqlite = new DatabaseSync(':memory:');
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const provider = createUsdaFoodProvider({ baseUrl: `http://127.0.0.1:${server.address().port}`, allowInsecureHttp: true });
  const results = await provider.search('apple');
  assert.ok(results.length > 0, 'USDA returned no supported search results.');
  const item = results.find((food) => food.name.toLowerCase() === 'apple, raw') ?? results[0];
  const detail = await provider.get(item.externalId);
  assert.ok(detail, 'USDA detail is missing.');
  const db = adapt(sqlite); await initializeDatabase(db);
  const foods = createRepositories(db, randomUUID).foods;
  const id = await foods.saveExternal(provider.id, detail.externalId, detail);
  assert.equal(await foods.saveExternal(provider.id, detail.externalId, detail), id);
  const cached = await foods.get(id);
  assert.equal(cached.calories, detail.calories); assert.equal(cached.external_id, detail.externalId);
  assert.ok((await foods.search('apple')).some((food) => food.id === id));
  assert.equal((await foods.list()).filter((food) => food.provider === provider.id).length, 1);
  console.log(JSON.stringify({ result: 'Live search, detail, SQLite cache and deduplication passed', provider: provider.id,
    externalId: detail.externalId, name: detail.name, calories: detail.calories, servingAmount: detail.serving_amount,
    servingUnit: detail.serving_unit, protein: detail.protein, carbohydrates: detail.carbohydrates, fat: detail.fat }, null, 2));
} finally { sqlite.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
