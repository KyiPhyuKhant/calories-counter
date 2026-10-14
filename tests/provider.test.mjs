import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { mapUsdaFood, createUsdaFoodProvider } from '../src/data/usdaFoodProvider.ts';
import { createFoodApi } from '../server/food-api.mjs';
import { initializeDatabase } from '../src/data/migrations.ts';
import { createRepositories } from '../src/data/repositories.ts';
import { adapt } from './sqlite.mjs';

// Synthetic protocol fixtures, not real USDA responses or nutritional guidance.
const searchFood = { fdcId: 700000001, description: 'Synthetic test food', dataType: 'Foundation', foodNutrients: [
  { nutrientId: 2048, unitName: 'KCAL', value: 200 }, { nutrientId: 1003, unitName: 'G', value: 5 },
  { nutrientId: 1004, unitName: 'G', value: 0 },
] };
const detailFood = { ...searchFood, foodNutrients: searchFood.foodNutrients.map((row) => ({ nutrient: { id: row.nutrientId, unitName: row.unitName }, amount: row.value })),
  foodPortions: [{ amount: 1, gramWeight: 40, measureUnit: { name: 'cup' }, modifier: 'test portion' }] };
const response = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });

async function serve(t, options) {
  const server = createFoodApi(options);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}`;
}

test('USDA mapping distinguishes search/details, scales only reported gram portions and preserves unknown macros', () => {
  const search = mapUsdaFood(searchFood); const detail = mapUsdaFood(detailFood);
  assert.equal(search.calories, 200); assert.equal(search.serving_amount, 100);
  assert.equal(detail.calories, 80); assert.equal(detail.serving_amount, 40); assert.equal(detail.serving_unit, 'g');
  assert.equal(detail.protein, 2); assert.equal(detail.fat, 0); assert.equal(detail.carbohydrates, null);
  assert.match(detail.notes, /USDA FoodData Central/); assert.match(detail.notes, /1 cup test portion/);
  assert.equal(detail.externalId, '700000001'); assert.match(detail.sourceUrl, /fdc.nal.usda.gov/);
  for (const override of [{ fdcId: -1 }, { description: '' }, { dataType: 'Branded' }, { foodNutrients: [] },
    { foodNutrients: [{ nutrientId: 1008, unitName: 'KJ', value: 200 }] }]) assert.equal(mapUsdaFood({ ...searchFood, ...override }), null);
  assert.equal(mapUsdaFood({ ...searchFood, foodNutrients: [{ nutrientId: 1008, unitName: 'KCAL', value: 0 }] }).calories, 0);
  assert.equal(mapUsdaFood({ ...detailFood, foodPortions: [{ servingSize: 1, gramWeight: null }] }).serving_amount, 100);
  assert.equal(mapUsdaFood({ ...searchFood, foodNutrients: [{ nutrientId: 2047, unitName: 'KCAL', value: 123 }] }).calories, 123);
});

test('client validates configuration, sanitizes failures, rejects malformed nutrition, handles empty and not-found responses', async () => {
  assert.throws(() => createUsdaFoodProvider({ baseUrl: '' }), /configured/);
  assert.throws(() => createUsdaFoodProvider({ baseUrl: 'http://example.com' }), /secure/);
  assert.throws(() => createUsdaFoodProvider({ baseUrl: 'https://user:password@example.com' }), /credentials/);
  let calls = 0;
  let reply = response({ foods: [] });
  const provider = createUsdaFoodProvider({ baseUrl: 'https://proxy.example', fetcher: async () => { calls++; return reply; } });
  assert.deepEqual(await provider.search(''), []); assert.equal(calls, 0);
  assert.deepEqual(await provider.search('anything'), []);
  await assert.rejects(provider.get('../secret'), /Invalid USDA/);
  reply = response({}, 404); assert.equal(await provider.get('123'), null);
  reply = response({}); await assert.rejects(provider.search('food'), (error) => error.code === 'response');
  reply = response(detailFood); await assert.rejects(provider.get('123'), /supported calorie/);
  for (const [status, code] of [[403, 'authorization'], [503, 'authorization'], [500, 'network'], [504, 'timeout'], [429, 'rate-limit']]) {
    reply = response({ error: 'Sensitive upstream text must never be echoed' }, status, { 'Retry-After': '60' });
    await assert.rejects(provider.search('food'), (error) => error.code === code && !error.message.includes('Sensitive') && (status !== 429 || error.retryAfterSeconds === 60));
  }
  reply = new Response('not JSON'); await assert.rejects(provider.search('food'), (error) => error.code === 'response');
  const broken = createUsdaFoodProvider({ baseUrl: 'https://proxy.example', fetcher: async () => { throw new Error('secret URL'); } });
  await assert.rejects(broken.search('food'), (error) => error.code === 'network' && !error.message.includes('secret'));
});

test('timeouts cover fetch and body parsing; cancellation is immediate even if transport ignores AbortSignal', async () => {
  const never = () => new Promise(() => {});
  const timeout = createUsdaFoodProvider({ baseUrl: 'https://proxy.example', timeoutMs: 15, fetcher: never });
  await assert.rejects(timeout.search('food'), (error) => error.code === 'timeout');
  const body = createUsdaFoodProvider({ baseUrl: 'https://proxy.example', timeoutMs: 15, fetcher: async () => ({ ok: true, status: 200, json: never }) });
  await assert.rejects(body.search('food'), (error) => error.code === 'timeout');
  const controller = new AbortController(); const pending = timeout.search('food', { signal: controller.signal }); controller.abort();
  await assert.rejects(pending, (error) => error.code === 'cancelled');
  await assert.rejects(timeout.search('food', { signal: controller.signal }), (error) => error.code === 'cancelled');
});

test('client-to-proxy search/detail pipeline keeps credentials server-side and caches selected foods without duplicates', async (t) => {
  const requests = [];
  const baseUrl = await serve(t, { apiKey: 'unit-test-placeholder', fetcher: async (url, options) => {
    requests.push({ url, options });
    return response(url.endsWith('/foods/search') ? { foods: [searchFood] } : detailFood);
  } });
  const provider = createUsdaFoodProvider({ baseUrl, allowInsecureHttp: true });
  const [result] = await provider.search('food & rice'); const selected = await provider.get(result.externalId);
  assert.equal(requests[0].options.headers['X-Api-Key'], 'unit-test-placeholder');
  assert.equal(JSON.parse(requests[0].options.body).query, 'food & rice');
  assert.equal(requests[0].url, 'https://api.nal.usda.gov/fdc/v1/foods/search');
  assert.equal(requests[1].options.redirect, 'error');
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close()); const db = adapt(sqlite); await initializeDatabase(db);
  const r = createRepositories(db, randomUUID);
  const id = await r.foods.saveExternal(provider.id, selected.externalId, selected);
  assert.equal(await r.foods.saveExternal(provider.id, selected.externalId, selected), id);
  assert.equal((await r.foods.search('synthetic')).length, 1);
  const cached = await r.foods.get(id); assert.equal(cached.calories, 80); assert.equal(cached.calories_per_100g, 200); assert.equal(cached.source, 'external');
  assert.equal(cached.provider, 'usda-fdc'); assert.equal(cached.external_id, '700000001');
  await r.foods.createCustom({ name: 'Offline custom food', calories: 1, serving_amount: 1, serving_unit: 'piece' });
  assert.equal((await r.foods.search('offline')).length, 1);
  // Offline reuse is a repository read; it must not call the online provider.
  const before = requests.length; assert.equal((await r.foods.get(id)).protein, 2); assert.equal(requests.length, before);
});

test('proxy rejects unconfigured/invalid requests, never forwards arbitrary destinations, and enforces local limits', async (t) => {
  const missing = await serve(t, {});
  assert.equal((await fetch(`${missing}/foods/search?query=food`)).status, 503);
  let calls = 0;
  const base = await serve(t, { apiKey: 'unit-test-placeholder', maxRequestsPerHour: 1, fetcher: async () => { calls++; return response({ foods: [] }); } });
  for (const [path, status] of [['/foods/search?query=', 400], ['/foods/../../secrets', 404], ['/arbitrary', 404]]) assert.equal((await fetch(`${base}${path}`)).status, status);
  assert.equal((await fetch(`${base}/foods/search?query=food`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${base}/foods/search?query=food`)).status, 200);
  const blocked = await fetch(`${base}/foods/search?query=food`); assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get('Retry-After')) > 0);
  assert.equal(calls, 1);
});

test('proxy propagates rate cooldowns and sanitizes upstream authorization and network failures', async (t) => {
  let calls = 0;
  const base = await serve(t, { apiKey: 'unit-test-placeholder', fetcher: async () => { calls++; return response({ error: 'private credential echo' }, 429, { 'Retry-After': '30' }); } });
  const rate = await fetch(`${base}/foods/123`); assert.equal(rate.status, 429); assert.equal(rate.headers.get('Retry-After'), '30');
  assert.ok(!(await rate.text()).includes('credential'));
  assert.equal((await fetch(`${base}/foods/123`)).status, 429); assert.equal(calls, 1);
  const denied = await serve(t, { apiKey: 'unit-test-placeholder', fetcher: async () => response({ error: 'private credential echo' }, 403) });
  const failure = await fetch(`${denied}/foods/123`); assert.equal(failure.status, 403); assert.ok(!(await failure.text()).includes('credential'));
  const offline = await serve(t, { apiKey: 'unit-test-placeholder', fetcher: async () => { throw new Error('private URL'); } });
  assert.equal((await fetch(`${offline}/foods/123`)).status, 502);
});

test('proxy timeouts abort the upstream request and return a usable timeout status', async (t) => {
  const base = await serve(t, { apiKey: 'unit-test-placeholder', timeoutMs: 15,
    fetcher: async (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true })) });
  const result = await fetch(`${base}/foods/123`);
  assert.equal(result.status, 504); assert.match((await result.json()).error, /timed out/);
});
