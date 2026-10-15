import { calculateServing, type FoodInput, type FoodSource, type ServingUnit } from './food.ts';

export const meals = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
export type Meal = typeof meals[number];
export type QuantityMode = 'amount' | 'servings';
export interface DiaryInput { date: string; meal: Meal; quantity: number; quantity_mode: QuantityMode }
export interface DiaryEntry {
  id: string; profile_id: string; food_id: string | null; name: string;
  source: FoodSource | 'unknown'; provider: string | null; external_id: string | null;
  serving_amount: number; serving_unit: ServingUnit; calories: number;
  protein: number | null; carbohydrates: number | null; fat: number | null; notes: string | null;
  entry_date: string; meal: Meal; quantity: number; quantity_mode: QuantityMode;
  total_calories: number; total_protein: number | null; total_carbohydrates: number | null; total_fat: number | null;
  consumed_at: string; created_at: string; updated_at: string;
  // Legacy gram fields remain available for existing repository callers.
  amount_g: number | null; calories_per_100g: number | null;
  protein_per_100g: number | null; carbs_per_100g: number | null; fat_per_100g: number | null;
}

export function validateCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Select a valid calendar date.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (year < 1900 || year > 2100 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error('Select a valid date between 1900 and 2100.');
  }
  return date;
}

export function localCalendarDate(date = new Date()) {
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid timestamp.');
  const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  validateCalendarDate(value);
  return value;
}

export function shiftCalendarDate(value: string, days: number) {
  if (!Number.isInteger(days)) throw new Error('Date offset must be a whole number.');
  const date = validateCalendarDate(value);
  // Calendar arithmetic, not adding 24 hours: days can span DST changes.
  date.setDate(date.getDate() + days);
  return localCalendarDate(date);
}

export function calendarDateLabel(value: string) {
  const date = validateCalendarDate(value);
  // App copy is English; avoid native calendar overrides changing the stored year.
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function validateDiaryInput(input: DiaryInput) {
  validateCalendarDate(input.date);
  if (!meals.includes(input.meal)) throw new Error('Select breakfast, lunch, dinner, or snacks.');
  if (!['amount', 'servings'].includes(input.quantity_mode)) throw new Error('Select an amount or number of servings.');
  if (!Number.isFinite(input.quantity) || input.quantity <= 0 || input.quantity > 100000) throw new Error('Enter a positive finite quantity up to 100000.');
}

export function calculateDiaryNutrition(food: FoodInput, input: DiaryInput) {
  validateDiaryInput(input);
  const amount = input.quantity_mode === 'servings' ? input.quantity * food.serving_amount : input.quantity;
  const nutrition = calculateServing(food, amount);
  if (nutrition.calories === null) throw new Error('Calories are unavailable. Provide nutrition for your own portion before logging or planning this food.');
  return { amount, ...nutrition, calories: nutrition.calories };
}

export function dailyTotals(entries: Pick<DiaryEntry, 'meal' | 'total_calories'>[]) {
  const byMeal: Record<Meal, number> = { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 };
  for (const entry of entries) {
    if (!meals.includes(entry.meal) || !Number.isFinite(entry.total_calories) || entry.total_calories < 0) throw new Error('Invalid diary nutrition.');
    byMeal[entry.meal] += entry.total_calories;
  }
  return { byMeal, total: Object.values(byMeal).reduce((sum, calories) => sum + calories, 0) };
}
