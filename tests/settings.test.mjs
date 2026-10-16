import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import React from 'react';
import { initializeDatabase, migrations } from '../src/data/migrations.ts';
import { createRepositories } from '../src/data/repositories.ts';
import { seedBundledFoodCatalog } from '../src/data/bundledFoodCatalog.ts';
import { adapt } from './sqlite.mjs';
import { native, renderModule } from './helpers/renderUI.mjs';

const tables = ['user_profiles', 'foods', 'diary_entries', 'planned_meals', 'weight_history', 'calorie_target_history'];
const date = '2026-10-13';
const food = { name: 'Settings fixture', calories: 200, serving_amount: 100, serving_unit: 'g' };
const entry = { date, meal: 'breakfast', quantity: 1, quantity_mode: 'servings' };

async function fixture(db) {
  await initializeDatabase(db);
  await seedBundledFoodCatalog(db);
  const r = createRepositories(db, randomUUID, () => `${date}T12:00:00.000Z`);
  await r.profiles.saveCalorieProfile({ sex: 'male', age: 30, height_cm: 175, current_weight_kg: 80,
    target_weight_kg: 75, activity_level: 'sedentary', goal: 'lose', manual_calorie_target: null });
  const foodId = await r.foods.createCustom(food);
  const plan = await r.plans.addEntry(foodId, entry);
  await r.plans.markEaten(plan, date);
  await r.diary.addEntry(foodId, { ...entry, meal: 'lunch' });
  await r.weights.create(date, 80);
  return { r, plan };
}

test('clear data removes every app record, persists across reopen and allows fresh offline setup', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'calnote-reset-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'test.db');
  const sqlite = new DatabaseSync(path);
  try {
    const db = adapt(sqlite); const { r } = await fixture(db);
    for (const table of tables) assert.ok((await db.getFirstAsync(`SELECT count(*) AS n FROM ${table}`)).n > 0);
    let notifications = 0;
    r.subscribe(() => { notifications++; });
    await r.data.clearAll();
    assert.equal(notifications, 1);
    for (const table of tables) assert.equal((await db.getFirstAsync(`SELECT count(*) AS n FROM ${table}`)).n, 0);
    assert.deepEqual(await r.foods.search('Settings fixture'), []);
    assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, migrations.at(-1).version);
    assert.deepEqual(await db.getAllAsync('PRAGMA foreign_key_check'), []);
    assert.ok(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'plans_eaten_delete'"));
    await r.data.clearAll();
  } finally { sqlite.close(); }
  const reopened = new DatabaseSync(path);
  try {
    const db = adapt(reopened);
    for (const table of tables) assert.equal((await db.getFirstAsync(`SELECT count(*) AS n FROM ${table}`)).n, 0);
    await initializeDatabase(db);
    await seedBundledFoodCatalog(db);
    const r = createRepositories(db, randomUUID);
    assert.equal(await r.profiles.get(), null);
    assert.equal((await db.getFirstAsync('SELECT count(*) AS n FROM foods')).n, 150);
    assert.deepEqual(await r.foods.search('Settings fixture'), []);
    await r.profiles.save({ name: 'Fresh setup' });
    const id = await r.foods.createCustom(food);
    const plan = await r.plans.addEntry(id, entry);
    await r.plans.markEaten(plan, date);
    await assert.rejects(r.plans.remove(plan), /retained|eaten/i);
  } finally { reopened.close(); }
});

test('a failed reset rolls back all records and the eaten-plan safeguard, without notifying subscribers', async (t) => {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  const db = adapt(sqlite); const { r, plan } = await fixture(db);
  const before = await Promise.all(tables.map((table) => db.getAllAsync(`SELECT * FROM ${table} ORDER BY rowid`)));
  let notifications = 0; r.subscribe(() => { notifications++; });
  const exec = db.execAsync;
  db.execAsync = async (sql) => {
    await exec(sql);
    if (sql.includes('DELETE FROM foods')) throw new Error('Simulated reset failure');
  };
  await assert.rejects(r.data.clearAll(), /Simulated reset failure/);
  assert.equal(notifications, 0);
  assert.deepEqual(await Promise.all(tables.map((table) => db.getAllAsync(`SELECT * FROM ${table} ORDER BY rowid`))), before);
  await assert.rejects(r.plans.remove(plan), /retained|eaten/i);
  assert.equal((await db.getFirstAsync('PRAGMA foreign_keys')).foreign_keys, 1);
  db.execAsync = exec;
  await r.data.clearAll();
  assert.equal(notifications, 1);
});

function settings(clearAll, version = '0.1.0') {
  const alerts = []; const updates = [];
  const result = renderModule('src/screens/AppSettingsScreen.tsx', 'AppSettingsScreen', {}, {
    react: { ...React, useState: (initial) => [initial, (value) => updates.push(value)] },
    'react-native': { ...native, Alert: { alert: (...args) => alerts.push(args) } },
    'expo-constants': { __esModule: true, default: { expoConfig: { version } } },
    '@/data/DatabaseProvider': { useRepositories: () => ({ data: { clearAll } }) },
  });
  return { ...result, alerts, updates };
}

test('settings uses English labels without Daily Goals and keeps appearance, units, branding and version', () => {
  const { nodes, markup } = settings(async () => {});
  for (const text of ['General', 'Data &amp; Privacy', 'About',
    'English', 'Light', 'Kilograms (kg)', 'Centimeters (cm)', 'Kilocalories (kcal)', 'CalNote', '0.1.0']) assert.ok(markup.includes(text));
  assert.ok(nodes.some(({ type, props }) => type === 'Image' && props.accessibilityLabel === 'CalNote logo'));
  assert.doesNotMatch(markup, /နေ့စဉ်ရည်မှန်းချက်များ|Daily Goals|Calorie goal/);
  for (const { type, props } of nodes) {
    if (type === 'Text' && typeof props.children === 'string') assert.doesNotMatch(props.children, /[\u1000-\u109f\uaa60-\uaa7f\ua9e0-\ua9ff]/);
  }
  assert.match(settings(async () => {}, null).markup, /Unavailable/);
});

test('clear data requires destructive confirmation and prevents repeated requests while clearing', async () => {
  let count = 0; let resolve;
  const { nodes, alerts } = settings(() => { count++; return new Promise((done) => { resolve = done; }); });
  const button = nodes.find(({ type, props }) => type === 'Pressable' && props.accessibilityLabel === 'Clear all data');
  button.props.onPress(); assert.equal(count, 0);
  const [, message, actions] = alerts[0];
  assert.match(message, /cannot be undone/); assert.match(message, /next launch/);
  assert.doesNotMatch(alerts[0][0] + message + actions.map(({ text }) => text).join(''), /[\u1000-\u109f]/);
  assert.equal(actions[0].style, 'cancel'); assert.equal(actions[0].onPress, undefined);
  assert.equal(actions[1].style, 'destructive');
  actions[1].onPress(); actions[1].onPress(); button.props.onPress();
  assert.equal(count, 1); assert.equal(alerts.length, 1);
  resolve(); await new Promise(setImmediate);
});

test('reset failures expose an English error and allow retry', async () => {
  let count = 0;
  const { nodes, alerts, updates } = settings(async () => { count++; throw new Error('Disk failure'); });
  const button = nodes.find(({ type, props }) => type === 'Pressable' && props.accessibilityLabel === 'Clear all data');
  button.props.onPress(); alerts[0][2][1].onPress(); await new Promise(setImmediate);
  assert.ok(updates.some((value) => typeof value === 'string' && value.includes('Your data is unchanged') && !/[\u1000-\u109f]/.test(value)));
  assert.equal(updates.at(-1), false);
  button.props.onPress(); alerts[1][2][1].onPress(); await new Promise(setImmediate);
  assert.equal(count, 2);
});
