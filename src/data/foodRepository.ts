import {
  foodSearchExpression, isCuisine, normalizeFood, normalizeFoodName, nutritionPer100g,
  type Cuisine, type Food, type FoodInput,
} from '../domain/food.ts';
import type { Database, SqlExecutor } from './database.ts';

export class DuplicateFoodError extends Error {
  constructor() { super('A food with this name and serving already exists.'); this.name = 'DuplicateFoodError'; }
}

function values(input: FoodInput) {
  const food = normalizeFood(input);
  const per100g = nutritionPer100g(food);
  return [food.name, normalizeFoodName(food.name), food.calories, food.serving_amount, food.serving_unit,
    food.protein, food.carbohydrates, food.fat, food.notes,
    per100g?.calories ?? null, per100g?.protein ?? null, per100g?.carbohydrates ?? null, per100g?.fat ?? null];
}

const columns = `name, search_key, calories, serving_amount, serving_unit, protein, carbohydrates, fat, notes,
  calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g`;

export async function insertBundledFood(tx: SqlExecutor, id: string, input: FoodInput) {
  await tx.runAsync(`INSERT INTO foods (id, ${columns}, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bundled', ?, ?)`,
  id, ...values(input), '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
}

export function createFoodRepository(db: Database, newId: () => string, now: () => string) {
  async function checkDuplicate(input: FoodInput, exceptId: string | null = null) {
    const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM foods WHERE source = 'custom'
      AND search_key = ? AND serving_amount = ? AND serving_unit = ? AND (? IS NULL OR id != ?) LIMIT 1`,
    normalizeFoodName(input.name), input.serving_amount, input.serving_unit, exceptId, exceptId);
    if (existing) throw new DuplicateFoodError();
  }
  async function customWrite(operation: () => Promise<unknown>) {
    try { await operation(); } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed: foods.dedupe_key')) throw new DuplicateFoodError();
      throw error;
    }
  }
  async function createCustom(input: FoodInput) {
    const data = values(input);
    await checkDuplicate(input);
    const id = newId();
    const time = now();
    const key = JSON.stringify([normalizeFoodName(input.name), input.serving_amount, input.serving_unit]);
    await customWrite(() => db.runAsync(`INSERT INTO foods (id, ${columns}, dedupe_key, cuisine, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'custom', ?, ?)`, id, ...data, key, input.cuisine ?? null, time, time));
    return id;
  }
  async function updateCustom(id: string, input: FoodInput) {
    const data = values(input);
    await checkDuplicate(input, id);
    await customWrite(async () => {
      const result = await db.runAsync(`UPDATE foods SET name = ?, search_key = ?, calories = ?,
        serving_amount = ?, serving_unit = ?, protein = ?, carbohydrates = ?, fat = ?, notes = ?,
        calories_per_100g = ?, protein_per_100g = ?, carbs_per_100g = ?, fat_per_100g = ?, dedupe_key = ?,
        cuisine = CASE WHEN ? THEN ? ELSE cuisine END, updated_at = ?
        WHERE id = ? AND source = 'custom'`, ...data,
      JSON.stringify([normalizeFoodName(input.name), input.serving_amount, input.serving_unit]),
      input.cuisine !== undefined ? 1 : 0, input.cuisine ?? null, now(), id);
      if (result.changes !== 1) throw new Error('Custom food not found.');
    });
  }
  return {
    get: (id: string) => db.getFirstAsync<Food>('SELECT * FROM foods WHERE id = ?', id),
    list: () => db.getAllAsync<Food>('SELECT * FROM foods ORDER BY name COLLATE NOCASE, id'),
    async search(query: string, limit = 50, offset = 0, cuisine: Cuisine | null = null) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) throw new Error('Invalid search page.');
      if (cuisine !== null && !isCuisine(cuisine)) throw new Error('Invalid cuisine filter.');
      const expression = foodSearchExpression(query);
      const filter = cuisine === null ? '' : 'WHERE cuisine = ?';
      const filterParams = cuisine === null ? [] : [cuisine];
      if (!query.trim()) return db.getAllAsync<Food>(`SELECT * FROM foods ${filter} ORDER BY name COLLATE NOCASE, id LIMIT ? OFFSET ?`, ...filterParams, limit, offset);
      if (!expression) return [];
      return db.getAllAsync<Food>(`SELECT foods.* FROM foods JOIN food_search ON food_search.rowid = foods.rowid
        WHERE food_search MATCH ? ${cuisine === null ? '' : 'AND foods.cuisine = ?'}
        ORDER BY foods.name COLLATE NOCASE, foods.id LIMIT ? OFFSET ?`, expression, ...filterParams, limit, offset);
    },
    createCustom,
    updateCustom,
    async remove(id: string) {
      const result = await db.runAsync("DELETE FROM foods WHERE id = ? AND source = 'custom'", id);
      if (result.changes !== 1) throw new Error('Custom food not found.');
    },
    async saveExternal(provider: string, externalId: string, input: FoodInput) {
      if (!provider.trim() || provider.length > 100 || !externalId.trim() || externalId.length > 200) throw new Error('Provider and external ID are required.');
      const time = now();
      const row = await db.getFirstAsync<{ id: string }>(`INSERT INTO foods
        (id, ${columns}, cuisine, source, provider, external_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'external', ?, ?, ?, ?)
        ON CONFLICT(provider, external_id) WHERE source = 'external' DO UPDATE SET
          name = excluded.name, search_key = excluded.search_key, calories = excluded.calories,
          serving_amount = excluded.serving_amount, serving_unit = excluded.serving_unit,
          protein = excluded.protein, carbohydrates = excluded.carbohydrates, fat = excluded.fat,
          notes = excluded.notes, calories_per_100g = excluded.calories_per_100g,
          protein_per_100g = excluded.protein_per_100g, carbs_per_100g = excluded.carbs_per_100g,
          fat_per_100g = excluded.fat_per_100g,
          cuisine = CASE WHEN ? THEN excluded.cuisine ELSE foods.cuisine END,
          updated_at = excluded.updated_at RETURNING id`,
      newId(), ...values(input), input.cuisine ?? null, provider.trim().toLowerCase(), externalId.trim(), time, time,
      input.cuisine !== undefined ? 1 : 0);
      if (!row) throw new Error('External food could not be saved.');
      return row.id;
    },
    // Preserve the original per-100g data-access contract for existing callers.
    create: (input: { name: string; calories_per_100g: number; protein_per_100g: number | null; carbs_per_100g: number | null; fat_per_100g: number | null }) =>
      createCustom({ name: input.name, calories: input.calories_per_100g, protein: input.protein_per_100g,
        carbohydrates: input.carbs_per_100g, fat: input.fat_per_100g, serving_amount: 100, serving_unit: 'g' }),
    update: (id: string, input: { name: string; calories_per_100g: number; protein_per_100g: number | null; carbs_per_100g: number | null; fat_per_100g: number | null }) =>
      updateCustom(id, { name: input.name, calories: input.calories_per_100g, protein: input.protein_per_100g,
        carbohydrates: input.carbs_per_100g, fat: input.fat_per_100g, serving_amount: 100, serving_unit: 'g' }),
  };
}
