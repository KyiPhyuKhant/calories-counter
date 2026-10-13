import type { Database, SqlExecutor } from './database.ts';
import { writeNutritionSnapshot } from './snapshotWriter.ts';
import { calculateDiaryNutrition, localCalendarDate, validateCalendarDate, validateDiaryInput, type DiaryEntry, type DiaryInput, type Meal } from '../domain/diary.ts';
import { convertServingAmount, type Food } from '../domain/food.ts';

export interface PlannedFood extends Omit<DiaryEntry, 'consumed_at'> {
  planned_at: string;
  eaten_at: string | null;
  eaten_date: string | null;
  diary_entry_id: string | null;
}

export function createPlanRepository(db: Database, newId: () => string, now: () => string) {
  const get = (tx: SqlExecutor, id: string) => tx.getFirstAsync<PlannedFood>('SELECT * FROM planned_meals WHERE id = ?', id);
  const listDay = (tx: SqlExecutor, date: string) => tx.getAllAsync<PlannedFood>(`SELECT * FROM planned_meals
    WHERE entry_date = ? AND profile_id = (SELECT id FROM user_profiles WHERE singleton = 1) ORDER BY created_at, id`, date);

  async function addInTransaction(tx: SqlExecutor, foodId: string, input: DiaryInput, requestedProfile?: string, at = now()) {
    const food = await tx.getFirstAsync<Food>('SELECT * FROM foods WHERE id = ?', foodId);
    if (!food) throw new Error('Food not found.');
    let profileId = requestedProfile;
    if (profileId) {
      if (!await tx.getFirstAsync('SELECT id FROM user_profiles WHERE id = ?', profileId)) throw new Error('Profile not found.');
    } else {
      const time = now();
      await tx.runAsync('INSERT OR IGNORE INTO user_profiles (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', newId(), 'Local user', time, time);
      const profile = await tx.getFirstAsync<{ id: string }>('SELECT id FROM user_profiles WHERE singleton = 1');
      if (!profile) throw new Error('Local profile could not be opened.');
      profileId = profile.id;
    }
    return writeNutritionSnapshot(tx, 'planned_meals', food, food.id, profileId, input, newId(), now(), at);
  }

  function validateEatenDate(date: string) {
    validateCalendarDate(date);
    if (date > localCalendarDate(new Date(now()))) throw new Error('Food cannot be marked eaten on a future date.');
  }
  async function eat(tx: SqlExecutor, plan: PlannedFood, date: string) {
    if (plan.eaten_at) return { entryId: plan.diary_entry_id, created: false };
    const time = now();
    const entryId = await writeNutritionSnapshot(tx, 'diary_entries', plan, plan.food_id, plan.profile_id,
      { date, meal: plan.meal, quantity: plan.quantity, quantity_mode: plan.quantity_mode }, newId(), time);
    const result = await tx.runAsync(`UPDATE planned_meals SET eaten_at = ?, eaten_date = ?, diary_entry_id = ?, updated_at = ?
      WHERE id = ? AND eaten_at IS NULL`, time, date, entryId, time, plan.id);
    if (result.changes !== 1) throw new Error('This food has already been marked eaten.');
    return { entryId, created: true };
  }

  return {
    get: (id: string) => get(db, id),
    list: (profileId: string) => db.getAllAsync<PlannedFood>('SELECT * FROM planned_meals WHERE profile_id = ? ORDER BY planned_at, id', profileId),
    listDay(date: string) { validateCalendarDate(date); return listDay(db, date); },
    async addEntry(foodId: string, input: DiaryInput) {
      validateDiaryInput(input);
      let id = '';
      await db.withExclusiveTransactionAsync(async (tx) => { id = await addInTransaction(tx, foodId, input); });
      return id;
    },
    async update(id: string, input: DiaryInput) {
      validateDiaryInput(input);
      await db.withExclusiveTransactionAsync(async (tx) => {
        const plan = await get(tx, id);
        if (!plan) throw new Error('Planned food not found.');
        if (plan.eaten_at) throw new Error('Eaten plans are read-only. Edit the consumed entry in the diary instead.');
        const nutrition = calculateDiaryNutrition(plan, input);
        const isMass = ['g', 'kg', 'oz'].includes(plan.serving_unit);
        await tx.runAsync(`UPDATE planned_meals SET entry_date = ?, meal = ?, quantity = ?, quantity_mode = ?,
          total_calories = ?, total_protein = ?, total_carbohydrates = ?, total_fat = ?, amount_g = ?, updated_at = ? WHERE id = ?`,
        input.date, input.meal, input.quantity, input.quantity_mode, nutrition.calories, nutrition.protein,
        nutrition.carbohydrates, nutrition.fat, isMass ? convertServingAmount(nutrition.amount, plan.serving_unit, 'g') : null, now(), id);
      });
    },
    async remove(id: string) {
      const result = await db.runAsync('DELETE FROM planned_meals WHERE id = ? AND eaten_at IS NULL', id);
      if (result.changes !== 1) throw new Error('Planned food not found or already eaten. Eaten plans are retained as history.');
    },
    async copyDay(source: string, destination: string) {
      validateCalendarDate(source); validateCalendarDate(destination);
      if (source === destination) throw new Error('Choose a different destination date.');
      let count = 0;
      await db.withExclusiveTransactionAsync(async (tx) => {
        const plans = await listDay(tx, source);
        if (!plans.length) throw new Error('There is no plan to copy on this date.');
        if ((await listDay(tx, destination)).length) throw new Error('Choose an empty destination date to avoid duplicate plans.');
        for (const plan of plans) {
          await writeNutritionSnapshot(tx, 'planned_meals', plan, plan.food_id, plan.profile_id,
            { date: destination, meal: plan.meal, quantity: plan.quantity, quantity_mode: plan.quantity_mode }, newId(), now());
          count++;
        }
      });
      return count;
    },
    async markEaten(id: string, date = localCalendarDate(new Date(now()))) {
      validateEatenDate(date);
      let result: { entryId: string | null; created: boolean } = { entryId: null, created: false };
      await db.withExclusiveTransactionAsync(async (tx) => {
        const plan = await get(tx, id);
        if (!plan) throw new Error('Planned food not found.');
        result = await eat(tx, plan, date);
      });
      return result;
    },
    async markMealEaten(date: string, meal: Meal, eatenDate = localCalendarDate(new Date(now()))) {
      validateDiaryInput({ date, meal, quantity: 1, quantity_mode: 'servings' }); validateEatenDate(eatenDate);
      let count = 0;
      await db.withExclusiveTransactionAsync(async (tx) => {
        const plans = (await listDay(tx, date)).filter((plan) => plan.meal === meal);
        if (!plans.length) throw new Error('This meal has no planned foods.');
        for (const plan of plans) if ((await eat(tx, plan, eatenDate)).created) count++;
      });
      return count;
    },
    // Preserve gram-based callers while new screens support every serving unit.
    async add(profileId: string, foodId: string, amountG: number, plannedAt: string) {
      const date = localCalendarDate(new Date(plannedAt));
      let id = '';
      await db.withExclusiveTransactionAsync(async (tx) => {
        const food = await tx.getFirstAsync<Food>('SELECT * FROM foods WHERE id = ?', foodId);
        if (!food) throw new Error('Food not found.');
        if (food.calories_per_100g === null) throw new Error('This food needs a gram conversion before planning.');
        id = await addInTransaction(tx, foodId, { date, meal: 'snacks', quantity: convertServingAmount(amountG, 'g', food.serving_unit), quantity_mode: 'amount' }, profileId, new Date(plannedAt).toISOString());
      });
      return id;
    },
  };
}
