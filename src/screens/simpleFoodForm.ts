import { normalizeFoodName, type Cuisine, type Food, type FoodInput, type ServingUnit } from '../domain/food.ts';
import { parseFormNumber } from '../domain/formNumber.ts';
import { displayFoodName, isMyanmar } from '../i18n/foodMy.ts';

export type SimpleFoodForm = { name: string; cuisine: Cuisine | null; calories: string; serving_amount: string; serving_unit: ServingUnit };

export function createSimpleFoodForm(food?: Food): SimpleFoodForm {
  return { name: food ? displayFoodName(food) : '', cuisine: food?.cuisine ?? null, calories: food?.calories?.toString() ?? '',
    serving_amount: food?.serving_amount.toString() ?? '100', serving_unit: food?.serving_unit ?? 'g' };
}

export function simpleFoodInput(form: SimpleFoodForm, original?: Food): FoodInput {
  const enteredName = form.name.trim();
  const renamed = !original || normalizeFoodName(enteredName) !== normalizeFoodName(displayFoodName(original));
  let name = original?.name ?? enteredName;
  let nativeName = original?.native_name ?? null;
  const aliases = [...(original?.aliases ?? [])];
  if (renamed) {
    if (isMyanmar(enteredName)) {
      if (!original || isMyanmar(original.name)) name = enteredName;
      nativeName = enteredName;
    } else {
      name = enteredName;
      if (nativeName && isMyanmar(nativeName)) nativeName = null;
    }
    for (const previous of [original?.name, original?.native_name]) {
      if (previous && previous !== name && previous !== nativeName && !aliases.includes(previous) && aliases.length < 32) aliases.push(previous);
    }
  }
  const calories = form.calories.trim() ? parseFormNumber(form.calories) : null;
  const amount = parseFormNumber(form.serving_amount);
  const nutritionChanged = !original || calories !== original.calories || amount !== original.serving_amount || form.serving_unit !== original.serving_unit;
  return { name, native_name: nativeName, aliases, cuisine: form.cuisine, calories, serving_amount: amount, serving_unit: form.serving_unit,
    protein: original?.protein ?? null, carbohydrates: original?.carbohydrates ?? null, fat: original?.fat ?? null,
    notes: original?.notes ?? null, nutrition_source: original?.nutrition_source ?? null, category: original?.category ?? null, image: original?.image ?? null,
    nutrition_status: nutritionChanged ? calories === null ? 'unverified' : 'user_entered' : original.nutrition_status };
}
