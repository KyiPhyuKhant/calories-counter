import { calculateDiaryNutrition, type DiaryEntry, type DiaryInput } from '../domain/diary.ts';
import { convertServingAmount, nutritionPer100g } from '../domain/food.ts';
import type { SqlExecutor } from './database.ts';

export type NutritionSnapshot = Pick<DiaryEntry, 'name' | 'source' | 'provider' | 'external_id' |
  'serving_amount' | 'serving_unit' | 'protein' | 'carbohydrates' | 'fat' | 'notes'> & { calories: number | null };

export async function updateNutritionSnapshot(
  tx: SqlExecutor, table: 'diary_entries' | 'planned_meals', snapshot: NutritionSnapshot & { id: string },
  input: DiaryInput, time: string,
) {
  const nutrition = calculateDiaryNutrition(snapshot, input);
  const isMass = ['g', 'kg', 'oz'].includes(snapshot.serving_unit);
  await tx.runAsync(`UPDATE ${table} SET entry_date = ?, meal = ?, quantity = ?, quantity_mode = ?,
    total_calories = ?, total_protein = ?, total_carbohydrates = ?, total_fat = ?, amount_g = ?, updated_at = ? WHERE id = ?`,
  input.date, input.meal, input.quantity, input.quantity_mode, nutrition.calories,
  nutrition.protein, nutrition.carbohydrates, nutrition.fat,
  isMass ? convertServingAmount(nutrition.amount, snapshot.serving_unit, 'g') : null, time, snapshot.id);
}

export async function writeNutritionSnapshot(
  tx: SqlExecutor, table: 'diary_entries' | 'planned_meals', snapshot: NutritionSnapshot,
  foodId: string | null, profileId: string, input: DiaryInput, id: string, time: string, at = time,
) {
  const nutrition = calculateDiaryNutrition(snapshot, input);
  const basis = nutritionPer100g(snapshot);
  const amountG = basis ? convertServingAmount(nutrition.amount, snapshot.serving_unit, 'g') : null;
  const timeColumn = table === 'diary_entries' ? 'consumed_at' : 'planned_at';
  // Both identifiers are internal constants; all user values remain parameters.
  await tx.runAsync(`INSERT INTO ${table} (id, profile_id, food_id, name, source, provider, external_id,
    serving_amount, serving_unit, calories, protein, carbohydrates, fat, notes,
    entry_date, meal, quantity, quantity_mode, total_calories, total_protein, total_carbohydrates, total_fat,
    ${timeColumn}, created_at, updated_at, amount_g, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  id, profileId, foodId, snapshot.name, snapshot.source, snapshot.provider, snapshot.external_id,
  snapshot.serving_amount, snapshot.serving_unit, snapshot.calories, snapshot.protein, snapshot.carbohydrates,
  snapshot.fat, snapshot.notes, input.date, input.meal, input.quantity, input.quantity_mode,
  nutrition.calories, nutrition.protein, nutrition.carbohydrates, nutrition.fat, at, time, time,
  amountG, basis?.calories ?? null, basis?.protein ?? null, basis?.carbohydrates ?? null, basis?.fat ?? null);
  return id;
}
