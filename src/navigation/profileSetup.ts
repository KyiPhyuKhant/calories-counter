import type { Profile } from '../data/repositories.ts';
import { validateCalorieProfile, type ActivityLevel, type CalorieProfile, type EquationSex, type Goal } from '../domain/calorieGoal.ts';
import { parseFormNumber } from '../domain/formNumber.ts';

export type ProfileForm = {
  sex: EquationSex | ''; age: string; height_cm: string; current_weight_kg: string; target_weight_kg: string;
  activity_level: ActivityLevel; goal: Goal; manual_calorie_target: string; useManual: boolean;
};

export function createProfileForm(profile: Profile | null = null): ProfileForm {
  return {
    sex: profile?.sex ?? '', age: profile?.age?.toString() ?? '', height_cm: profile?.height_cm?.toString() ?? '',
    current_weight_kg: profile?.current_weight_kg?.toString() ?? '', target_weight_kg: profile?.target_weight_kg?.toString() ?? '',
    activity_level: profile?.activity_level ?? 'sedentary', goal: profile?.goal ?? 'maintain',
    manual_calorie_target: profile?.manual_calorie_target?.toString() ?? '', useManual: profile?.manual_calorie_target != null,
  };
}

export function calorieProfileFromForm(form: ProfileForm): CalorieProfile {
  return {
    sex: form.sex as EquationSex, age: parseFormNumber(form.age), height_cm: parseFormNumber(form.height_cm),
    current_weight_kg: parseFormNumber(form.current_weight_kg), target_weight_kg: parseFormNumber(form.target_weight_kg),
    activity_level: form.activity_level, goal: form.goal,
    manual_calorie_target: form.useManual ? parseFormNumber(form.manual_calorie_target) : null,
  };
}

export function completedProfileInput(profile: Profile | null) {
  if (!profile || profile.activity_level === null || profile.goal === null) return null;
  const input = calorieProfileFromForm(createProfileForm(profile));
  return Object.keys(validateCalorieProfile(input)).length ? null : input;
}

export function profileSetupErrors(form: ProfileForm) {
  return validateCalorieProfile({ ...calorieProfileFromForm(form), activity_level: 'sedentary', goal: 'maintain', manual_calorie_target: null });
}
