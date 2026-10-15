import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createProfileForm, calorieProfileFromForm, completedProfileInput, profileSetupErrors } from '../src/navigation/profileSetup.ts';
import { initializeDatabase, migrations } from '../src/data/migrations.ts';
import { createRepositories } from '../src/data/repositories.ts';
import { adapt } from './sqlite.mjs';

const input = {
  sex: 'male', age: 30, height_cm: 180, current_weight_kg: 80, target_weight_kg: 75,
  activity_level: 'moderate', goal: 'lose', manual_calorie_target: null,
};
const profile = { id: 'existing', name: 'Local user', created_at: '2026-10-14T08:00:00Z', updated_at: '2026-10-14T08:00:00Z', ...input };

test('onboarding is required for absent, skeletal, invalid and unsafe profiles, not completed local profiles', () => {
  assert.equal(completedProfileInput(null), null);
  assert.equal(completedProfileInput({ ...profile, sex: null }), null);
  assert.equal(completedProfileInput({ ...profile, activity_level: null }), null);
  assert.equal(completedProfileInput({ ...profile, goal: null }), null);
  assert.equal(completedProfileInput({ ...profile, manual_calorie_target: 500 }), null);
  assert.equal(completedProfileInput({ ...profile, age: 17 }), null);
  assert.deepEqual(completedProfileInput(profile), input);
  assert.equal(completedProfileInput({ ...profile, manual_calorie_target: 2400 }).manual_calorie_target, 2400);
});

test('profile drafts preserve saved values and parse local decimal input with the same validator', () => {
  const form = createProfileForm(profile);
  assert.deepEqual(calorieProfileFromForm(form), input);
  assert.equal(form.useManual, false);
  assert.equal(createProfileForm({ ...profile, manual_calorie_target: 2400 }).useManual, true);
  assert.equal(calorieProfileFromForm({ ...form, current_weight_kg: '80,5' }).current_weight_kg, 80.5);
  assert.ok(profileSetupErrors(createProfileForm()).sex);
  assert.deepEqual(profileSetupErrors({ ...form, goal: 'gain', useManual: true, manual_calorie_target: '10' }), {});
  assert.ok(profileSetupErrors({ ...form, target_weight_kg: '1' }).target_weight_kg);
});

test('finishing setup updates the existing SQLite profile without losing prior diary, plans or weight history', async (t) => {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  const db = adapt(sqlite); await initializeDatabase(db);
  const r = createRepositories(db, randomUUID, () => '2026-10-14T08:00:00Z');
  const id = await r.profiles.save({ name: 'Existing local user' });
  const food = (await r.foods.search(''))[0];
  await r.diary.addEntry(food.id, { date: '2026-10-14', meal: 'breakfast', quantity: 1, quantity_mode: 'servings' });
  await r.plans.addEntry(food.id, { date: '2026-10-15', meal: 'lunch', quantity: 1, quantity_mode: 'servings' });
  await r.weights.create('2026-10-14', 80);
  assert.equal(completedProfileInput(await r.profiles.get()), null);
  assert.equal(await r.profiles.saveCalorieProfile(input), id);
  await initializeDatabase(db);
  const reopened = createRepositories(db, randomUUID);
  assert.deepEqual(completedProfileInput(await reopened.profiles.get()), input);
  assert.equal((await reopened.profiles.get()).name, 'Existing local user');
  assert.equal((await reopened.diary.listDay('2026-10-14')).length, 1);
  assert.equal((await reopened.plans.listDay('2026-10-15')).length, 1);
  assert.equal((await reopened.weights.list(id)).length, 1);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, migrations.at(-1).version);
});
