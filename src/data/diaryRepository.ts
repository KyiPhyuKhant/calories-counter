import {
  calculateDiaryNutrition, localCalendarDate, validateCalendarDate, validateDiaryInput,
  type DiaryEntry, type DiaryInput,
} from '../domain/diary.ts';
import { convertServingAmount, type Food } from '../domain/food.ts';
import type { Database, SqlExecutor } from './database.ts';
import { writeNutritionSnapshot } from './snapshotWriter.ts';

export function createDiaryRepository(db: Database, newId: () => string, now: () => string) {
  async function profileForLogging(tx: SqlExecutor, requested?: string) {
    if (requested) {
      const profile = await tx.getFirstAsync<{ id: string }>('SELECT id FROM user_profiles WHERE id = ?', requested);
      if (!profile) throw new Error('Profile not found.');
      return profile.id;
    }
    const id = newId();
    const time = now();
    await tx.runAsync('INSERT OR IGNORE INTO user_profiles (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', id, 'Local user', time, time);
    const profile = await tx.getFirstAsync<{ id: string }>('SELECT id FROM user_profiles WHERE singleton = 1');
    if (!profile) throw new Error('Local profile could not be opened.');
    return profile.id;
  }

  async function insert(tx: SqlExecutor, food: Food, input: DiaryInput, requestedProfile?: string, consumedAt = now()) {
    const profile = await profileForLogging(tx, requestedProfile);
    return writeNutritionSnapshot(tx, 'diary_entries', food, food.id, profile, input, newId(), now(), consumedAt);
  }

  async function addEntry(foodId: string, input: DiaryInput, profileId?: string) {
    validateDiaryInput(input);
    let id = '';
    await db.withExclusiveTransactionAsync(async (tx) => {
      const food = await tx.getFirstAsync<Food>('SELECT * FROM foods WHERE id = ?', foodId);
      if (!food) throw new Error('Food not found.');
      id = await insert(tx, food, input, profileId);
    });
    return id;
  }

  return {
    addEntry,
    get: (id: string) => db.getFirstAsync<DiaryEntry>('SELECT * FROM diary_entries WHERE id = ?', id),
    list: (profileId: string) => db.getAllAsync<DiaryEntry>('SELECT * FROM diary_entries WHERE profile_id = ? ORDER BY consumed_at DESC, id', profileId),
    listDay(date: string) {
      validateCalendarDate(date);
      return db.getAllAsync<DiaryEntry>(`SELECT * FROM diary_entries WHERE entry_date = ?
        AND profile_id = (SELECT id FROM user_profiles WHERE singleton = 1) ORDER BY created_at, id`, date);
    },
    async update(id: string, input: DiaryInput) {
      validateDiaryInput(input);
      await db.withExclusiveTransactionAsync(async (tx) => {
        const entry = await tx.getFirstAsync<DiaryEntry>('SELECT * FROM diary_entries WHERE id = ?', id);
        if (!entry) throw new Error('Diary entry not found.');
        const nutrition = calculateDiaryNutrition(entry, input);
        const isMass = ['g', 'kg', 'oz'].includes(entry.serving_unit);
        await tx.runAsync(`UPDATE diary_entries SET entry_date = ?, meal = ?, quantity = ?, quantity_mode = ?,
          total_calories = ?, total_protein = ?, total_carbohydrates = ?, total_fat = ?, amount_g = ?, updated_at = ? WHERE id = ?`,
        input.date, input.meal, input.quantity, input.quantity_mode, nutrition.calories,
        nutrition.protein, nutrition.carbohydrates, nutrition.fat,
        isMass ? convertServingAmount(nutrition.amount, entry.serving_unit, 'g') : null, now(), id);
      });
    },
    async remove(id: string) {
      const result = await db.runAsync('DELETE FROM diary_entries WHERE id = ?', id);
      if (result.changes !== 1) throw new Error('Diary entry not found.');
    },
    // Legacy callers pass grams and an instant; new screens always pass a local date.
    async add(profileId: string, foodId: string, amountG: number, consumedAt: string) {
      const date = localCalendarDate(new Date(consumedAt));
      let id = '';
      await db.withExclusiveTransactionAsync(async (tx) => {
        const food = await tx.getFirstAsync<Food>('SELECT * FROM foods WHERE id = ?', foodId);
        if (!food) throw new Error('Food not found.');
        if (food.calories_per_100g === null) throw new Error('This food needs a gram conversion before use in the diary.');
        id = await insert(tx, food, { date, meal: 'snacks', quantity: convertServingAmount(amountG, 'g', food.serving_unit), quantity_mode: 'amount' }, profileId, new Date(consumedAt).toISOString());
      });
      return id;
    },
  };
}
