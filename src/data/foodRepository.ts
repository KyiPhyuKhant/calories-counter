import {
  foodSearchExpression, isCuisine, normalizeFood, normalizeFoodName, nutritionPer100g,
  type Cuisine, type Food, type FoodInput,
} from '../domain/food.ts';
import type { Database, SqlExecutor } from './database.ts';
import { decodeFood, metadataColumns, metadataFields, metadataUpdateValues, metadataValues } from './foodMetadata.ts';

export class DuplicateFoodError extends Error {
  constructor() { super('A food with this name and serving already exists.'); this.name = 'DuplicateFoodError'; }
}

export function foodValues(input: FoodInput) {
  const food = normalizeFood(input);
  const per100g = nutritionPer100g(food);
  return [food.name, normalizeFoodName(food.name), food.calories, food.serving_amount, food.serving_unit,
    food.protein, food.carbohydrates, food.fat, food.notes,
    per100g?.calories ?? null, per100g?.protein ?? null, per100g?.carbohydrates ?? null, per100g?.fat ?? null];
}

export const foodColumns = `name, search_key, calories, serving_amount, serving_unit, protein, carbohydrates, fat, notes,
  calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g`;

// Keep bundled placeholders stored, but prefer a usable personal version in search.
const visibleInLibrary = `(foods.source != 'bundled' OR foods.calories IS NOT NULL OR NOT EXISTS (
  SELECT 1 FROM foods AS personal WHERE personal.source = 'custom' AND personal.calories IS NOT NULL
    AND personal.search_key = foods.search_key AND personal.cuisine IS foods.cuisine
    AND personal.serving_amount = foods.serving_amount AND personal.serving_unit = foods.serving_unit
))`;

export async function insertBundledFood(tx: SqlExecutor, id: string, input: FoodInput) {
  await tx.runAsync(`INSERT INTO foods (id, ${foodColumns}, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bundled', ?, ?)`,
  id, ...foodValues(input), '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
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
    const data = foodValues(input);
    await checkDuplicate(input);
    const id = newId();
    const time = now();
    const key = JSON.stringify([normalizeFoodName(input.name), input.serving_amount, input.serving_unit]);
    await customWrite(() => db.runAsync(`INSERT INTO foods (id, ${foodColumns}, dedupe_key, cuisine, ${metadataColumns}, source, created_at, updated_at)
      VALUES (${Array(22).fill('?').join(', ')}, 'custom', ?, ?)`, id, ...data, key, input.cuisine ?? null, ...metadataValues(input), time, time));
    return id;
  }
  async function updateCustom(id: string, input: FoodInput) {
    const data = foodValues(input);
    await checkDuplicate(input, id);
    await customWrite(async () => {
      const result = await db.runAsync(`UPDATE foods SET name = ?, search_key = ?, calories = ?,
        serving_amount = ?, serving_unit = ?, protein = ?, carbohydrates = ?, fat = ?, notes = ?,
        calories_per_100g = ?, protein_per_100g = ?, carbs_per_100g = ?, fat_per_100g = ?, dedupe_key = ?,
        cuisine = CASE WHEN ? THEN ? ELSE cuisine END,
        ${metadataFields.map((field) => `${field} = CASE WHEN ? THEN ? ELSE ${field} END`).join(', ')}, updated_at = ?
        WHERE id = ? AND source = 'custom'`, ...data,
      JSON.stringify([normalizeFoodName(input.name), input.serving_amount, input.serving_unit]),
      input.cuisine !== undefined ? 1 : 0, input.cuisine ?? null, ...metadataUpdateValues(input), now(), id);
      if (result.changes !== 1) throw new Error('Custom food not found.');
    });
  }
  return {
    async get(id: string) { const row = await db.getFirstAsync<Food>('SELECT * FROM foods WHERE id = ?', id); return row ? decodeFood(row) : null; },
    async list() { return (await db.getAllAsync<Food>('SELECT * FROM foods ORDER BY name COLLATE NOCASE, id')).map(decodeFood); },
    async search(query: string, limit = 50, offset = 0, cuisine: Cuisine | null = null) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) throw new Error('Invalid search page.');
      if (cuisine !== null && !isCuisine(cuisine)) throw new Error('Invalid cuisine filter.');
      const expression = foodSearchExpression(query);
      const filter = cuisine === null ? '' : 'AND foods.cuisine = ?';
      const filterParams = cuisine === null ? [] : [cuisine];
      if (!query.trim()) return (await db.getAllAsync<Food>(`SELECT foods.* FROM foods WHERE ${visibleInLibrary} ${filter}
        ORDER BY foods.name COLLATE NOCASE, foods.id LIMIT ? OFFSET ?`, ...filterParams, limit, offset)).map(decodeFood);
      if (!expression) return [];
      return (await db.getAllAsync<Food>(`SELECT foods.* FROM foods JOIN food_search ON food_search.rowid = foods.rowid
        WHERE food_search MATCH ? AND ${visibleInLibrary} ${filter}
        ORDER BY foods.name COLLATE NOCASE, foods.id LIMIT ? OFFSET ?`, expression, ...filterParams, limit, offset)).map(decodeFood);
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
        (id, ${foodColumns}, cuisine, ${metadataColumns}, source, provider, external_id, created_at, updated_at)
        VALUES (${Array(21).fill('?').join(', ')}, 'external', ?, ?, ?, ?)
        ON CONFLICT(provider, external_id) WHERE source = 'external' DO UPDATE SET
          name = excluded.name, search_key = excluded.search_key, calories = excluded.calories,
          serving_amount = excluded.serving_amount, serving_unit = excluded.serving_unit,
          protein = excluded.protein, carbohydrates = excluded.carbohydrates, fat = excluded.fat,
          notes = excluded.notes, calories_per_100g = excluded.calories_per_100g,
          protein_per_100g = excluded.protein_per_100g, carbs_per_100g = excluded.carbs_per_100g,
          fat_per_100g = excluded.fat_per_100g,
          cuisine = CASE WHEN ? THEN excluded.cuisine ELSE foods.cuisine END,
          ${metadataFields.map((field) => `${field} = CASE WHEN ? THEN excluded.${field} ELSE foods.${field} END`).join(', ')},
          updated_at = excluded.updated_at RETURNING id`,
      newId(), ...foodValues(input), input.cuisine ?? null, ...metadataValues(input), provider.trim().toLowerCase(), externalId.trim(), time, time,
      input.cuisine !== undefined ? 1 : 0, ...metadataFields.map((field) => input[field] !== undefined ? 1 : 0));
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
