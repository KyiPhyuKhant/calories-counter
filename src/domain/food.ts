export const servingUnits = ['g', 'kg', 'oz', 'ml', 'cup', 'piece', 'serving'] as const;
export type ServingUnit = typeof servingUnits[number];
export type FoodSource = 'bundled' | 'external' | 'custom';
export const cuisines = ['myanmar', 'japanese', 'western', 'chinese'] as const;
export type Cuisine = typeof cuisines[number];
export const cuisineLabels: Record<Cuisine, string> = {
  myanmar: 'မြန်မာ', japanese: 'ဂျပန်', western: 'အနောက်တိုင်း', chinese: 'တရုတ်',
};

export function isCuisine(value: unknown): value is Cuisine {
  return typeof value === 'string' && cuisines.includes(value as Cuisine);
}

export interface FoodInput {
  name: string;
  calories: number | null;
  serving_amount: number;
  serving_unit: ServingUnit;
  protein?: number | null;
  carbohydrates?: number | null;
  fat?: number | null;
  notes?: string | null;
  cuisine?: Cuisine | null;
  native_name?: string | null;
  aliases?: string[];
  category?: 'dish' | 'ingredient' | null;
  nutrition_source?: string | null;
  nutrition_status?: 'unverified' | 'user_entered' | 'source_backed' | 'recipe' | 'development';
  image?: string | null;
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
  if (input.calories !== null && (!Number.isFinite(input.calories) || input.calories < 0 || input.calories > 100000)) errors.calories = 'Enter calories from 0 to 100000 per declared serving, or leave blank if unknown.';
  if (!Number.isFinite(input.serving_amount) || input.serving_amount < 0.001 || input.serving_amount > 100000) errors.serving_amount = 'Enter a serving amount from 0.001 to 100000.';
  if (!servingUnits.includes(input.serving_unit)) errors.serving_unit = 'Select a serving unit.';
  for (const key of ['protein', 'carbohydrates', 'fat'] as const) {
    const value = input[key];
    if (value != null && (!Number.isFinite(value) || value < 0 || value > 100000)) errors[key] = 'Enter a nonnegative amount in grams, or leave blank.';
  }
  if ((input.notes?.length ?? 0) > 2000) errors.notes = 'Keep notes within 2000 characters.';
  if (input.cuisine != null && !isCuisine(input.cuisine)) errors.cuisine = 'Select a supported cuisine or leave it unspecified.';
  if (input.native_name != null && (typeof input.native_name !== 'string' || input.native_name.length > 120)) errors.native_name = 'Keep native names within 120 characters.';
  if (input.aliases !== undefined && (!Array.isArray(input.aliases) || input.aliases.length > 32 || input.aliases.some((alias) => typeof alias !== 'string' || !alias.trim() || alias.length > 120))) errors.aliases = 'Use up to 32 alternative names of 1-120 characters.';
  if (input.category != null && !['dish', 'ingredient'].includes(input.category)) errors.category = 'Select dish or ingredient.';
  if (input.nutrition_source != null && (typeof input.nutrition_source !== 'string' || input.nutrition_source.length > 2000)) errors.nutrition_source = 'Keep nutrition sources within 2000 characters.';
  if (input.nutrition_status !== undefined && !['unverified', 'user_entered', 'source_backed', 'recipe', 'development'].includes(input.nutrition_status)) errors.nutrition_status = 'Invalid nutrition status.';
  if (input.image != null && (typeof input.image !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*\.png$/.test(input.image))) errors.image = 'Use a local PNG filename, not a URL or path.';
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
    calories: food.calories === null ? null : food.calories * ratio,
    protein: food.protein === null ? null : food.protein * ratio,
    carbohydrates: food.carbohydrates === null ? null : food.carbohydrates * ratio,
    fat: food.fat === null ? null : food.fat * ratio,
  };
}

export function nutritionPer100g(input: FoodInput) {
  if (input.calories === null || !['g', 'kg', 'oz'].includes(input.serving_unit)) return null;
  return calculateServing(input, 100, 'g');
}

export function foodSearchExpression(query: string) {
  if (query.length > 120) throw new Error('Keep searches within 120 characters.');
  const tokens = query.normalize('NFKC').match(/[\p{L}\p{N}\p{M}]+/gu) ?? [];
  return tokens.map((token) => `"${token}"*`).join(' AND ');
}

export function hasKnownCalories(food: Pick<FoodInput, 'calories'>): food is typeof food & { calories: number } {
  return typeof food.calories === 'number' && Number.isFinite(food.calories) && food.calories >= 0 && food.calories <= 100000;
}
