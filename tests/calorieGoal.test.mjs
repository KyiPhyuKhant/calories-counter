import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activityLevels, calculateBmr, calculateTdee, calculateCalorieGoal,
  calorieTargetBounds, suggestCalorieTarget, validateCalorieProfile,
} from '../src/domain/calorieGoal.ts';

const profile = {
  sex: 'male', age: 30, height_cm: 180, current_weight_kg: 80,
  target_weight_kg: 75, activity_level: 'moderate', goal: 'lose', manual_calorie_target: null,
};

test('Mifflin-St Jeor gives the expected male and female estimates', () => {
  assert.equal(calculateBmr(profile), 1780);
  assert.equal(calculateBmr({ ...profile, sex: 'female' }), 1614);
  assert.equal(calculateBmr({ ...profile, sex: 'female', age: 40, height_cm: 165, current_weight_kg: 60 }), 1270.25);
});

test('each documented activity factor scales resting expenditure', () => {
  const factors = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  for (const [level, factor] of Object.entries(factors)) {
    assert.equal(activityLevels[level].factor, factor);
    assert.equal(calculateTdee(1780, level), 1780 * factor);
  }
  assert.throws(() => calculateTdee(NaN, 'light'));
  assert.throws(() => calculateTdee(1780, 'toString'));
});

test('goals use moderate adjustments and target weight does not set energy needs', () => {
  const loss = calculateCalorieGoal(profile);
  assert.equal(loss.tdee, 2759);
  assert.equal(loss.suggested, 2345);
  const maintain = calculateCalorieGoal({ ...profile, goal: 'maintain' });
  assert.equal(maintain.suggested, 2759);
  const gain = calculateCalorieGoal({ ...profile, goal: 'gain', target_weight_kg: 85 });
  assert.equal(gain.suggested, 3035);
  assert.deepEqual(calculateCalorieGoal({ ...profile, target_weight_kg: 70 }), loss);
  assert.equal(suggestCalorieTarget(3000, 5000, 'male', 'lose'), 4500);
});

test('manual targets obey bounds and can be reset to the suggestion', () => {
  const estimate = calculateCalorieGoal(profile);
  assert.equal(calculateCalorieGoal({ ...profile, manual_calorie_target: 2400 }).target, 2400);
  for (const target of [estimate.minimum, estimate.maximum]) {
    assert.equal(calculateCalorieGoal({ ...profile, manual_calorie_target: target }).target, target);
  }
  for (const target of [500, estimate.minimum - 1, estimate.maximum + 1, 2400.5, Infinity, NaN]) {
    assert.ok(validateCalorieProfile({ ...profile, manual_calorie_target: target }).manual_calorie_target);
  }
  assert.equal(calculateCalorieGoal(profile).target, estimate.suggested);
});

test('validation rejects incomplete, nonfinite, implausible, and unsupported inputs', () => {
  for (const [field, values] of Object.entries({
    sex: ['', 'other'], age: [17, 101, 30.5, NaN], height_cm: [119, 231, Infinity],
    current_weight_kg: [34, 301, NaN], target_weight_kg: [34, 301, Infinity],
    activity_level: ['unknown', 'constructor'], goal: ['unknown'],
  })) {
    for (const value of values) assert.ok(validateCalorieProfile({ ...profile, [field]: value })[field], `${field}: ${value}`);
  }
  assert.throws(() => calculateBmr({ ...profile, age: 17 }));
  assert.throws(() => suggestCalorieTarget(1780, 2759, 'male', 'unknown'));
  assert.throws(() => calorieTargetBounds(3000, 7000, 'male'));
  assert.ok(validateCalorieProfile({ ...profile, height_cm: 230, current_weight_kg: 300, target_weight_kg: 280, activity_level: 'very_active' }).estimate);
});

test('goal direction and low-BMI weight loss are rejected', () => {
  assert.ok(validateCalorieProfile({ ...profile, target_weight_kg: 85 }).target_weight_kg);
  assert.ok(validateCalorieProfile({ ...profile, goal: 'gain' }).target_weight_kg);
  assert.ok(validateCalorieProfile({ ...profile, target_weight_kg: 45 }).target_weight_kg);
  assert.ok(validateCalorieProfile({ ...profile, current_weight_kg: 50, target_weight_kg: 45 }).goal);
  const lowWeight = { ...profile, current_weight_kg: 50, target_weight_kg: 65, goal: 'gain' };
  const estimate = calculateCalorieGoal(lowWeight);
  assert.ok(estimate.minimum >= estimate.tdee);
  assert.ok(validateCalorieProfile({ ...lowWeight, manual_calorie_target: Math.floor(estimate.tdee) - 1 }).manual_calorie_target);
});

test('small estimated needs and rounding never bypass calorie floors or deficit limits', () => {
  const result = calculateCalorieGoal({ ...profile, sex: 'female', age: 60, height_cm: 150, current_weight_kg: 50, target_weight_kg: 48, activity_level: 'sedentary' });
  assert.ok(result.target >= 1200);
  assert.ok(result.target >= result.bmr);
  for (const sex of ['male', 'female']) {
    for (const bmr of [1000, 1270.25, 1780, 2500, 3000]) {
      for (const activity of Object.keys(activityLevels)) {
        const tdee = calculateTdee(bmr, activity);
        if ((sex === 'male' ? 1500 : 1200) > Math.floor(tdee + Math.min(500, tdee * 0.15))) {
          assert.throws(() => calorieTargetBounds(bmr, tdee, sex), /outside/);
          continue;
        }
        for (const goal of ['lose', 'maintain', 'gain']) {
          const target = suggestCalorieTarget(bmr, tdee, sex, goal);
          const { minimum, maximum } = calorieTargetBounds(bmr, tdee, sex);
          assert.ok(Number.isInteger(target) && target >= minimum && target <= maximum);
          assert.ok(target >= tdee - 500 && target >= tdee * 0.8 && target >= bmr);
        }
      }
    }
  }
});
