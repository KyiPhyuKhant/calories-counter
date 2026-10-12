export type EquationSex = 'female' | 'male';
export type Goal = 'lose' | 'maintain' | 'gain';

// Conventional activity multipliers; these are estimates, not exercise measurements.
export const activityLevels = {
  sedentary: { label: 'Sedentary', detail: 'Little exercise', factor: 1.2 },
  light: { label: 'Lightly active', detail: 'Exercise 1-3 days/week', factor: 1.375 },
  moderate: { label: 'Moderately active', detail: 'Exercise 3-5 days/week', factor: 1.55 },
  active: { label: 'Very active', detail: 'Hard exercise 6-7 days/week', factor: 1.725 },
  very_active: { label: 'Extremely active', detail: 'Physical work and intensive training', factor: 1.9 },
} as const;
export type ActivityLevel = keyof typeof activityLevels;

export interface CalorieProfile {
  sex: EquationSex;
  age: number;
  height_cm: number;
  current_weight_kg: number;
  target_weight_kg: number;
  activity_level: ActivityLevel;
  goal: Goal;
  manual_calorie_target: number | null;
}
export type ProfileErrors = Partial<Record<keyof CalorieProfile | 'estimate', string>>;
type BodyInput = Pick<CalorieProfile, 'sex' | 'age' | 'height_cm' | 'current_weight_kg'>;

function bodyErrors(input: BodyInput): ProfileErrors {
  const errors: ProfileErrors = {};
  if (input.sex !== 'female' && input.sex !== 'male') errors.sex = 'Select an equation sex.';
  if (!Number.isInteger(input.age) || input.age < 18 || input.age > 100) errors.age = 'Enter a whole age from 18 to 100.';
  if (!Number.isFinite(input.height_cm) || input.height_cm < 120 || input.height_cm > 230) errors.height_cm = 'Enter a height from 120 to 230 cm.';
  if (!Number.isFinite(input.current_weight_kg) || input.current_weight_kg < 35 || input.current_weight_kg > 300) errors.current_weight_kg = 'Enter a weight from 35 to 300 kg.';
  return errors;
}

// Mifflin-St Jeor predicts resting expenditure; the UI calls this estimated BMR.
export function calculateBmr(input: BodyInput): number {
  if (Object.keys(bodyErrors(input)).length) throw new Error('Invalid body measurements.');
  return 10 * input.current_weight_kg + 6.25 * input.height_cm - 5 * input.age + (input.sex === 'male' ? 5 : -161);
}

export function calculateTdee(bmr: number, activity: ActivityLevel): number {
  if (!Number.isFinite(bmr) || bmr <= 0 || !Object.hasOwn(activityLevels, activity)) {
    throw new Error('Invalid BMR or activity level.');
  }
  return bmr * activityLevels[activity].factor;
}

export function calorieTargetBounds(bmr: number, tdee: number, sex: EquationSex) {
  if (!Number.isFinite(bmr) || bmr <= 0 || !Number.isFinite(tdee) || tdee < bmr ||
      (sex !== 'female' && sex !== 'male')) throw new Error('Invalid calorie estimate.');
  // App guardrails, not a universal clinical prescription: never below estimated BMR,
  // a 20% deficit, a 500 kcal deficit, or the sex-specific intake floor.
  const minimum = Math.ceil(Math.max(sex === 'male' ? 1500 : 1200, bmr, tdee * 0.8, tdee - 500));
  const maximum = Math.floor(Math.min(6000, tdee + Math.min(500, tdee * 0.15)));
  if (minimum > maximum || tdee > 6000) throw new Error('Estimate is outside this calculator. Consult a clinician.');
  return { minimum, maximum };
}

export function suggestCalorieTarget(bmr: number, tdee: number, sex: EquationSex, goal: Goal) {
  if (!['lose', 'maintain', 'gain'].includes(goal)) throw new Error('Invalid goal.');
  const bounds = calorieTargetBounds(bmr, tdee, sex);
  const adjustment = goal === 'lose' ? -Math.min(500, tdee * 0.15)
    : goal === 'gain' ? Math.min(300, tdee * 0.1) : 0;
  return Math.min(bounds.maximum, Math.max(bounds.minimum, Math.round(tdee + adjustment)));
}

function profileBounds(input: CalorieProfile, bmr: number, tdee: number) {
  const bounds = calorieTargetBounds(bmr, tdee, input.sex);
  const bmi = input.current_weight_kg / (input.height_cm / 100) ** 2;
  if (bmi < 18.5) bounds.minimum = Math.max(bounds.minimum, Math.ceil(tdee));
  return bounds;
}

export function validateCalorieProfile(input: CalorieProfile): ProfileErrors {
  const errors = bodyErrors(input);
  if (!Object.hasOwn(activityLevels, input.activity_level)) errors.activity_level = 'Select an activity level.';
  if (!['lose', 'maintain', 'gain'].includes(input.goal)) errors.goal = 'Select a goal.';
  if (!Number.isFinite(input.target_weight_kg) || input.target_weight_kg < 35 || input.target_weight_kg > 300) {
    errors.target_weight_kg = 'Enter a target from 35 to 300 kg.';
  }
  if (!errors.height_cm && !errors.current_weight_kg && !errors.target_weight_kg) {
    const heightM = input.height_cm / 100;
    if (input.target_weight_kg / (heightM * heightM) < 18.5) errors.target_weight_kg = 'This target is below the adult BMI screening range. Discuss it with a clinician.';
    if (input.goal === 'lose') {
      if (input.current_weight_kg / (heightM * heightM) < 18.5) errors.goal = 'Weight-loss targets are unavailable at a low current BMI.';
      if (input.target_weight_kg >= input.current_weight_kg) errors.target_weight_kg = 'For weight loss, choose a target below current weight.';
    }
    if (input.goal === 'gain' && input.target_weight_kg <= input.current_weight_kg) errors.target_weight_kg = 'For weight gain, choose a target above current weight.';
  }
  if (!Object.keys(errors).length) {
    try {
      const bmr = calculateBmr(input);
      const tdee = calculateTdee(bmr, input.activity_level);
      const { minimum, maximum } = profileBounds(input, bmr, tdee);
      const manual = input.manual_calorie_target;
      if (manual !== null && (!Number.isInteger(manual) || manual < minimum || manual > maximum)) {
        errors.manual_calorie_target = `Enter a whole target from ${minimum} to ${maximum} kcal/day.`;
      }
    } catch {
      errors.estimate = 'These measurements need an individual assessment. Consult a clinician.';
    }
  }
  return errors;
}

export function calculateCalorieGoal(input: CalorieProfile) {
  const errors = validateCalorieProfile(input);
  if (Object.keys(errors).length) throw new Error(Object.values(errors).join(' '));
  const bmr = calculateBmr(input);
  const tdee = calculateTdee(bmr, input.activity_level);
  const bounds = profileBounds(input, bmr, tdee);
  const suggested = Math.max(bounds.minimum, suggestCalorieTarget(bmr, tdee, input.sex, input.goal));
  return {
    bmr, tdee, suggested,
    target: input.manual_calorie_target ?? suggested,
    ...bounds,
  };
}
