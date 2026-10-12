import type { FoodInput } from '../domain/food.ts';

const samples: (FoodInput & { id: string })[] = [
  { id: 'dev:oats:v1', name: 'Demo oats', calories: 380, serving_amount: 100, serving_unit: 'g', protein: 13, carbohydrates: 68, fat: 7 },
  { id: 'dev:apple:v1', name: 'Demo apple', calories: 80, serving_amount: 1, serving_unit: 'piece' },
  { id: 'dev:milk:v1', name: 'Demo milk', calories: 120, serving_amount: 250, serving_unit: 'ml', protein: 8, carbohydrates: 12, fat: 5 },
  { id: 'dev:rice:v1', name: 'Demo rice', calories: 200, serving_amount: 1, serving_unit: 'cup' },
];

export const developmentFoods = samples.map((food) => ({
  ...food, notes: 'Development sample: invented values, not verified nutritional data.',
}));
