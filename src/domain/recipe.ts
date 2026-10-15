import { calculateServing, servingUnits, type FoodInput, type ServingUnit } from './food.ts';

export function calculateRecipeNutrition(ingredients: { food: FoodInput; amount: number; unit: ServingUnit }[],
  cookedYield: { amount: number; unit: ServingUnit }, serving: { amount: number; unit: ServingUnit }) {
  if (!ingredients.length || !Number.isFinite(cookedYield.amount) || cookedYield.amount <= 0 || cookedYield.amount > 100000 || !servingUnits.includes(cookedYield.unit)) throw new Error('Provide ingredients and a measured cooked yield.');
  if (ingredients.some(({ food }) => food.nutrition_status === 'development')) throw new Error('Invented development values cannot be used for a measured recipe.');
  const parts = ingredients.map(({ food, amount, unit }) => calculateServing(food, amount, unit));
  if (parts.some((part) => part.calories === null)) throw new Error('Every ingredient needs known calories, including added oil and sauces.');
  const sum = (key: 'calories' | 'protein' | 'carbohydrates' | 'fat') => parts.some((part) => part[key] === null)
    ? null : parts.reduce((total, part) => total + part[key]!, 0);
  return calculateServing({ name: 'Measured recipe', calories: sum('calories'), protein: sum('protein'), carbohydrates: sum('carbohydrates'), fat: sum('fat'),
    serving_amount: cookedYield.amount, serving_unit: cookedYield.unit }, serving.amount, serving.unit);
}
