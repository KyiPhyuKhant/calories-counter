import { calculateCalorieGoal, type CalorieProfile } from './calorieGoal.ts';
import { dailyTotals, type DiaryEntry } from './diary.ts';

type SavedCalorieProfile = { [K in keyof CalorieProfile]: CalorieProfile[K] | null };

export function calorieProgress(target: number, consumed: number) {
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(consumed) || consumed < 0) {
    throw new Error('Invalid calorie progress.');
  }
  const remaining = target - consumed;
  return {
    target, consumed, remaining,
    over: Math.max(0, -remaining),
    state: remaining > 0 ? 'remaining' as const : remaining < 0 ? 'over' as const : 'reached' as const,
    fraction: Math.min(1, consumed / target),
  };
}

export function summarizeDashboard(profile: SavedCalorieProfile | null, entries: DiaryEntry[]) {
  let target: number | null = null;
  if (profile && Object.entries(profile).every(([key, value]) => key === 'manual_calorie_target' || value !== null)) {
    try { target = calculateCalorieGoal(profile as CalorieProfile).target; }
    catch { /* An incomplete or outdated profile needs editing, not a guessed target. */ }
  }
  const totals = dailyTotals(entries);
  return { totals, entries, progress: target === null ? null : calorieProgress(target, totals.total) };
}
