import type { Database, SqlExecutor } from './database.ts';

export interface Nutrition {
  name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
}
export interface Food extends Nutrition { id: string; created_at: string; updated_at: string }
export interface Profile { id: string; name: string; height_cm: number | null; created_at: string; updated_at: string }
export interface FoodSnapshot extends Nutrition {
  id: string;
  profile_id: string;
  food_id: string | null;
  amount_g: number;
  created_at: string;
}
export interface DiaryEntry extends FoodSnapshot { consumed_at: string }
export interface PlannedMeal extends FoodSnapshot { planned_at: string }
export interface WeightEntry { id: string; profile_id: string; weight_kg: number; measured_at: string; created_at: string }

function positive(value: number) {
  if (!Number.isFinite(value) || value <= 0) throw new Error('Expected a positive finite number.');
}
function name(value: string) {
  if (!value.trim()) throw new Error('A name is required.');
  return value.trim();
}
function timestamp(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid timestamp.');
  return date.toISOString();
}
function nutritionValues(food: Nutrition) {
  const values = [food.calories_per_100g, food.protein_per_100g, food.carbs_per_100g, food.fat_per_100g];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('Nutrition values must be finite and nonnegative.');
  }
  return [name(food.name), ...values];
}
async function requireChanged(result: Promise<{ changes: number }>) {
  if ((await result).changes !== 1) throw new Error('Record not found.');
}

export function createRepositories(db: Database, newId: () => string, now = () => new Date().toISOString()) {
  async function insertSnapshot(
    tx: SqlExecutor, table: 'diary_entries' | 'planned_meals',
    profileId: string, foodId: string, amountG: number, at: string,
  ) {
    positive(amountG);
    const time = timestamp(at);
    const id = newId();
    const timeColumn = table === 'diary_entries' ? 'consumed_at' : 'planned_at';
    // One statement copies the catalog snapshot atomically. Identifiers are internal constants.
    const result = await tx.runAsync(`
      INSERT INTO ${table} (id, profile_id, food_id, name, calories_per_100g,
        protein_per_100g, carbs_per_100g, fat_per_100g, amount_g, ${timeColumn}, created_at)
      SELECT ?, ?, id, name, calories_per_100g, protein_per_100g, carbs_per_100g,
        fat_per_100g, ?, ?, ? FROM foods WHERE id = ?`,
    id, profileId, amountG, time, now(), foodId);
    if (result.changes !== 1) throw new Error('Food not found.');
    return id;
  }

  return {
    profiles: {
      get: () => db.getFirstAsync<Profile>('SELECT * FROM user_profiles WHERE singleton = 1'),
      async save(input: { name: string; height_cm?: number | null }) {
        const height = input.height_cm ?? null;
        if (height !== null) positive(height);
        const displayName = name(input.name);
        let id = '';
        await db.withExclusiveTransactionAsync(async (tx) => {
          const existing = await tx.getFirstAsync<Profile>('SELECT * FROM user_profiles WHERE singleton = 1');
          id = existing?.id ?? newId();
          const time = now();
          await tx.runAsync(`INSERT INTO user_profiles (id, name, height_cm, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?) ON CONFLICT(singleton) DO UPDATE SET
            name = excluded.name, height_cm = excluded.height_cm, updated_at = excluded.updated_at`,
          id, displayName, height, time, time);
        });
        return id;
      },
    },
    foods: {
      get: (id: string) => db.getFirstAsync<Food>('SELECT * FROM foods WHERE id = ?', id),
      list: () => db.getAllAsync<Food>('SELECT * FROM foods ORDER BY name COLLATE NOCASE, id'),
      async create(input: Nutrition) {
        const values = nutritionValues(input);
        const id = newId();
        const time = now();
        await db.runAsync(`INSERT INTO foods (id, name, calories_per_100g, protein_per_100g,
          carbs_per_100g, fat_per_100g, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id, ...values, time, time);
        return id;
      },
      async update(id: string, input: Nutrition) {
        await requireChanged(db.runAsync(`UPDATE foods SET name = ?, calories_per_100g = ?,
          protein_per_100g = ?, carbs_per_100g = ?, fat_per_100g = ?, updated_at = ? WHERE id = ?`,
        ...nutritionValues(input), now(), id));
      },
      remove: (id: string) => requireChanged(db.runAsync('DELETE FROM foods WHERE id = ?', id)),
    },
    diary: {
      add: (profileId: string, foodId: string, amountG: number, consumedAt: string) =>
        insertSnapshot(db, 'diary_entries', profileId, foodId, amountG, consumedAt),
      list: (profileId: string) => db.getAllAsync<DiaryEntry>(
        'SELECT * FROM diary_entries WHERE profile_id = ? ORDER BY consumed_at DESC, id', profileId),
      remove: (id: string) => requireChanged(db.runAsync('DELETE FROM diary_entries WHERE id = ?', id)),
    },
    plans: {
      add: (profileId: string, foodId: string, amountG: number, plannedAt: string) =>
        insertSnapshot(db, 'planned_meals', profileId, foodId, amountG, plannedAt),
      list: (profileId: string) => db.getAllAsync<PlannedMeal>(
        'SELECT * FROM planned_meals WHERE profile_id = ? ORDER BY planned_at, id', profileId),
      remove: (id: string) => requireChanged(db.runAsync('DELETE FROM planned_meals WHERE id = ?', id)),
    },
    weights: {
      async add(profileId: string, weightKg: number, measuredAt: string) {
        positive(weightKg);
        const time = timestamp(measuredAt);
        const id = newId();
        await db.runAsync(`INSERT INTO weight_history (id, profile_id, weight_kg, measured_at, created_at)
          VALUES (?, ?, ?, ?, ?)`, id, profileId, weightKg, time, now());
        return id;
      },
      list: (profileId: string) => db.getAllAsync<WeightEntry>(
        'SELECT * FROM weight_history WHERE profile_id = ? ORDER BY measured_at DESC, id', profileId),
      remove: (id: string) => requireChanged(db.runAsync('DELETE FROM weight_history WHERE id = ?', id)),
    },
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
