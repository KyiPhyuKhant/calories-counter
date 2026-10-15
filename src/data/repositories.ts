import type { Database } from './database.ts';
import { calculateCalorieGoal, type CalorieProfile } from '../domain/calorieGoal.ts';
import { createFoodRepository } from './foodRepository.ts';
import { createDiaryRepository } from './diaryRepository.ts';
import { summarizeDashboard } from '../domain/dashboard.ts';
import { localCalendarDate, validateCalendarDate, type DiaryEntry } from '../domain/diary.ts';
import { createPlanRepository } from './planRepository.ts';
import { createWeightRepository } from './weightRepository.ts';
import { createHistoryRepository } from './historyRepository.ts';
import { recordCurrentTarget } from './targetHistory.ts';

export interface Profile {
  id: string;
  name: string;
  height_cm: number | null;
  sex: CalorieProfile['sex'] | null;
  age: number | null;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  activity_level: CalorieProfile['activity_level'] | null;
  goal: CalorieProfile['goal'] | null;
  manual_calorie_target: number | null;
  created_at: string;
  updated_at: string;
}

function positive(value: number) {
  if (!Number.isFinite(value) || value <= 0) throw new Error('Expected a positive finite number.');
}
function name(value: string) {
  if (!value.trim()) throw new Error('A name is required.');
  return value.trim();
}

export function createRepositories(db: Database, newId: () => string, now = () => new Date().toISOString()) {
  const repositories = {
    profiles: {
      get: () => db.getFirstAsync<Profile>('SELECT * FROM user_profiles WHERE singleton = 1'),
      async saveCalorieProfile(input: CalorieProfile) {
        calculateCalorieGoal(input);
        const time = now();
        let id = '';
        await db.withExclusiveTransactionAsync(async (tx) => {
          const row = await tx.getFirstAsync<{ id: string }>(`
            INSERT INTO user_profiles (id, name, height_cm, sex, age, current_weight_kg,
              target_weight_kg, activity_level, goal, manual_calorie_target, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(singleton) DO UPDATE SET height_cm = excluded.height_cm, sex = excluded.sex,
              age = excluded.age, current_weight_kg = excluded.current_weight_kg,
              target_weight_kg = excluded.target_weight_kg, activity_level = excluded.activity_level,
              goal = excluded.goal, manual_calorie_target = excluded.manual_calorie_target,
              updated_at = excluded.updated_at RETURNING id`,
          newId(), 'Local user', input.height_cm, input.sex, input.age, input.current_weight_kg,
          input.target_weight_kg, input.activity_level, input.goal, input.manual_calorie_target, time, time);
          if (!row) throw new Error('Profile could not be saved.');
          id = row.id;
          await recordCurrentTarget(tx, localCalendarDate(new Date(time)), time);
        });
        return id;
      },
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
          await recordCurrentTarget(tx, localCalendarDate(new Date(time)), time);
        });
        return id;
      },
    },
    foods: createFoodRepository(db, newId, now),
    diary: createDiaryRepository(db, newId, now),
    plans: createPlanRepository(db, newId, now),
    weights: createWeightRepository(db, newId, now),
    history: createHistoryRepository(db, now),
  };

  const listeners = new Set<() => void>();
  function observe<Args extends unknown[], Result>(operation: (...args: Args) => Promise<Result>) {
    return async (...args: Args): Promise<Result> => {
      const result = await operation(...args);
      for (const listener of listeners) {
        try { listener(); } catch (error) { console.error('Database change listener failed.', error); }
      }
      return result;
    };
  }
  return {
    ...repositories,
    profiles: { ...repositories.profiles,
      save: observe(repositories.profiles.save),
      saveCalorieProfile: observe(repositories.profiles.saveCalorieProfile),
    },
    diary: { ...repositories.diary,
      add: observe(repositories.diary.add), addEntry: observe(repositories.diary.addEntry),
      update: observe(repositories.diary.update), remove: observe(repositories.diary.remove),
    },
    plans: { ...repositories.plans,
      add: observe(repositories.plans.add), addEntry: observe(repositories.plans.addEntry),
      update: observe(repositories.plans.update), remove: observe(repositories.plans.remove),
      copyDay: observe(repositories.plans.copyDay), markEaten: observe(repositories.plans.markEaten),
      markMealEaten: observe(repositories.plans.markMealEaten),
    },
    weights: { ...repositories.weights,
      add: observe(repositories.weights.add), create: observe(repositories.weights.create),
      update: observe(repositories.weights.update), remove: observe(repositories.weights.remove),
    },
    dashboard: {
      async getDay(date: string) {
        validateCalendarDate(date);
        let profile: Profile | null = null;
        let entries: DiaryEntry[] = [];
        // Keep the profile and consumed entries in a single consistent read snapshot.
        await db.withExclusiveTransactionAsync(async (tx) => {
          profile = await tx.getFirstAsync<Profile>('SELECT * FROM user_profiles WHERE singleton = 1');
          entries = await tx.getAllAsync<DiaryEntry>(`SELECT * FROM diary_entries WHERE entry_date = ?
            AND profile_id = (SELECT id FROM user_profiles WHERE singleton = 1) ORDER BY created_at, id`, date);
        });
        return summarizeDashboard(profile, entries);
      },
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
