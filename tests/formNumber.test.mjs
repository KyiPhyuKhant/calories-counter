import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFormNumber } from '../src/domain/formNumber.ts';
import { validateFood } from '../src/domain/food.ts';
import { validateCalorieProfile } from '../src/domain/calorieGoal.ts';
import { validateWeight } from '../src/domain/history.ts';

test('form numbers accept decimal keyboard separators, fractional servings, and full-width digits', () => {
  for (const [input, expected] of [['70,25', 70.25], ['70.25', 70.25], [' .5 ', 0.5], [',5', 0.5], ['1.', 1], ['1,', 1], ['０．５', 0.5], ['0', 0]]) {
    assert.equal(parseFormNumber(input), expected, input);
  }
});

test('blank, ambiguous, nonfinite, negative and scientific form inputs are rejected', () => {
  for (const input of ['', ' ', '.', ',', '-1', '+1', '1,234.5', '1.234,5', '1 234', '1e3', 'Infinity', 'NaN', '1/2', '0x10', '1.2.3', '9'.repeat(400)]) {
    assert.ok(Number.isNaN(parseFormNumber(input)), input);
  }
});

test('locale-friendly parsing does not bypass domain limits or whole-year validation', () => {
  const profile = { sex: 'male', age: parseFormNumber('30,5'), height_cm: 180, current_weight_kg: 80, target_weight_kg: 80, activity_level: 'sedentary', goal: 'maintain', manual_calorie_target: null };
  assert.ok(validateCalorieProfile(profile).age);
  assert.ok(validateFood({ name: 'Test fixture', calories: 10, serving_amount: parseFormNumber('0,0001'), serving_unit: 'g' }).serving_amount);
  assert.throws(() => validateWeight('2026-10-15', parseFormNumber('300,1'), '2026-10-15'));
  validateWeight('2026-10-15', parseFormNumber('79,25'), '2026-10-15');
});
