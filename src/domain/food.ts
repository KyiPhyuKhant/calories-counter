export const servingUnits = ['g', 'kg', 'oz', 'ml', 'cup', 'piece', 'serving'] as const;
export type ServingUnit = typeof servingUnits[number];
export type FoodSource = 'bundled' | 'external' | 'custom';

export interface FoodInput {
  name: string;
  calories: number;
  serving_amount: number;
  serving_unit: ServingUnit;
  protein?: number | null;
  carbohydrates?: number | null;
  fat?: number | null;
  notes?: string | null;
}
export interface Food extends Required<FoodInput> {
  id: string;
  source: FoodSource;
  provider: string | null;
  external_id: string | null;
  search_key: string;
  calories_per_100g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
  created_at: string;
  updated_at: string;
}

export function normalizeFoodName(name: string) {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function validateFood(input: FoodInput): Partial<Record<keyof FoodInput, string>> {
  const errors: Partial<Record<keyof FoodInput, string>> = {};
  if (!input.name.trim() || input.name.trim().length > 120) errors.name = 'Enter a name of 1-120 characters.';
  if (!Number.isFinite(input.calories) || input.calories < 0 || input.calories > 100000) errors.calories = 'Enter calories from 0 to 100000 per declared serving.';
  if (!Number.isFinite(input.serving_amount) || input.serving_amount < 0.001 || input.serving_amount > 100000) errors.serving_amount = 'Enter a serving amount from 0.001 to 100000.';
  if (!servingUnits.includes(input.serving_unit)) errors.serving_unit = 'Select a serving unit.';
  for (const key of ['protein', 'carbohydrates', 'fat'] as const) {
    const value = input[key];
    if (value != null && (!Number.isFinite(value) || value < 0 || value > 100000)) errors[key] = 'Enter a nonnegative amount in grams, or leave blank.';
  }
  if ((input.notes?.length ?? 0) > 2000) errors.notes = 'Keep notes within 2000 characters.';
  return errors;
}

export function normalizeFood(input: FoodInput) {
  const errors = validateFood(input);
  if (Object.keys(errors).length) throw new Error(Object.values(errors).join(' '));
  return {
    ...input, name: input.name.normalize('NFKC').trim().replace(/\s+/g, ' '),
    protein: input.protein ?? null, carbohydrates: input.carbohydrates ?? null,
    fat: input.fat ?? null, notes: input.notes?.trim() || null,
  };
}

export function convertServingAmount(amount: number, fromUnit: ServingUnit, toUnit: ServingUnit) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) throw new Error('Enter a positive finite serving amount up to 100000.');
  const grams: Partial<Record<ServingUnit, number>> = { g: 1, kg: 1000, oz: 28.349523125 };
  if (!servingUnits.includes(fromUnit) || !servingUnits.includes(toUnit)) throw new Error('Invalid serving unit.');
  if (fromUnit !== toUnit) {
    const from = grams[fromUnit];
    const to = grams[toUnit];
    if (from === undefined || to === undefined) throw new Error('These units need a food-specific conversion.');
    return amount * from / to;
  }
  return amount;
}

export function calculateServing(input: FoodInput, amount: number, unit: ServingUnit = input.serving_unit) {
  const food = normalizeFood(input);
  const converted = convertServingAmount(amount, unit, food.serving_unit);
  const ratio = converted / food.serving_amount;
  return {
    calories: food.calories * ratio,
    protein: food.protein === null ? null : food.protein * ratio,
    carbohydrates: food.carbohydrates === null ? null : food.carbohydrates * ratio,
    fat: food.fat === null ? null : food.fat * ratio,
  };
}

export function nutritionPer100g(input: FoodInput) {
  if (!['g', 'kg', 'oz'].includes(input.serving_unit)) return null;
  return calculateServing(input, 100, 'g');
}

export function foodSearchExpression(query: string) {
  if (query.length > 120) throw new Error('Keep searches within 120 characters.');
  const tokens = query.normalize('NFKC').match(/[\p{L}\p{N}]+/gu) ?? [];
  return tokens.map((token) => `"${token}"*`).join(' AND ');
}
