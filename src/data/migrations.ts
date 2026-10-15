import type { Database } from './database.ts';
import { developmentFoods } from './developmentFoods.ts';
import { insertBundledFood } from './foodRepository.ts';
import { normalizeFoodName } from '../domain/food.ts';
import { localCalendarDate } from '../domain/diary.ts';
import { recordCurrentTarget } from './targetHistory.ts';

const nutritionColumns = `
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  calories_per_100g REAL NOT NULL CHECK (calories_per_100g >= 0),
  protein_per_100g REAL NOT NULL CHECK (protein_per_100g >= 0),
  carbs_per_100g REAL NOT NULL CHECK (carbs_per_100g >= 0),
  fat_per_100g REAL NOT NULL CHECK (fat_per_100g >= 0)`;

export const migrations = [{
  version: 1,
  sql: `
    CREATE TABLE user_profiles (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
      singleton INTEGER NOT NULL DEFAULT 1 UNIQUE CHECK (singleton = 1),
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      height_cm REAL CHECK (height_cm > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE foods (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
      ${nutritionColumns},
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX foods_name_idx ON foods(name COLLATE NOCASE);
    CREATE TABLE diary_entries (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
      profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
      food_id TEXT REFERENCES foods(id) ON DELETE SET NULL,
      ${nutritionColumns},
      amount_g REAL NOT NULL CHECK (amount_g > 0),
      consumed_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX diary_profile_time_idx ON diary_entries(profile_id, consumed_at, id);
    CREATE INDEX diary_food_idx ON diary_entries(food_id);
    CREATE TABLE planned_meals (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
      profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
      food_id TEXT REFERENCES foods(id) ON DELETE SET NULL,
      ${nutritionColumns},
      amount_g REAL NOT NULL CHECK (amount_g > 0),
      planned_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX plans_profile_time_idx ON planned_meals(profile_id, planned_at, id);
    CREATE INDEX plans_food_idx ON planned_meals(food_id);
    CREATE TABLE weight_history (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
      profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
      weight_kg REAL NOT NULL CHECK (weight_kg > 0),
      measured_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX weight_profile_time_idx ON weight_history(profile_id, measured_at, id);
  `,
}, {
  version: 2,
  sql: `
    ALTER TABLE user_profiles ADD COLUMN sex TEXT CHECK (sex IN ('female', 'male'));
    ALTER TABLE user_profiles ADD COLUMN age INTEGER CHECK (age BETWEEN 18 AND 100 AND age = CAST(age AS INTEGER));
    ALTER TABLE user_profiles ADD COLUMN current_weight_kg REAL CHECK (current_weight_kg BETWEEN 35 AND 300);
    ALTER TABLE user_profiles ADD COLUMN target_weight_kg REAL CHECK (target_weight_kg BETWEEN 35 AND 300);
    ALTER TABLE user_profiles ADD COLUMN activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active'));
    ALTER TABLE user_profiles ADD COLUMN goal TEXT CHECK (goal IN ('lose', 'maintain', 'gain'));
    ALTER TABLE user_profiles ADD COLUMN manual_calorie_target INTEGER CHECK (
      manual_calorie_target BETWEEN 1200 AND 6000 AND manual_calorie_target = CAST(manual_calorie_target AS INTEGER)
    );
  `,
}, {
  version: 3,
  sql: `
    CREATE TABLE foods_new (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      search_key TEXT NOT NULL,
      dedupe_key TEXT UNIQUE,
      calories REAL NOT NULL CHECK (calories >= 0),
      serving_amount REAL NOT NULL CHECK (serving_amount BETWEEN 0.001 AND 100000),
      serving_unit TEXT NOT NULL CHECK (serving_unit IN ('g', 'kg', 'oz', 'ml', 'cup', 'piece', 'serving')),
      protein REAL CHECK (protein >= 0),
      carbohydrates REAL CHECK (carbohydrates >= 0),
      fat REAL CHECK (fat >= 0),
      notes TEXT CHECK (length(notes) <= 2000),
      source TEXT NOT NULL CHECK (source IN ('bundled', 'external', 'custom')),
      provider TEXT,
      external_id TEXT,
      calories_per_100g REAL CHECK (calories_per_100g >= 0),
      protein_per_100g REAL CHECK (protein_per_100g >= 0),
      carbs_per_100g REAL CHECK (carbs_per_100g >= 0),
      fat_per_100g REAL CHECK (fat_per_100g >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK ((source = 'external' AND length(trim(provider)) > 0 AND length(trim(external_id)) > 0
        AND provider IS NOT NULL AND external_id IS NOT NULL)
        OR (source != 'external' AND provider IS NULL AND external_id IS NULL))
    );
    INSERT INTO foods_new (id, name, search_key, calories, serving_amount, serving_unit, protein,
      carbohydrates, fat, source, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, created_at, updated_at)
    SELECT id, name, lower(trim(name)), calories_per_100g, 100, 'g', protein_per_100g,
      carbs_per_100g, fat_per_100g, 'custom', calories_per_100g, protein_per_100g,
      carbs_per_100g, fat_per_100g, created_at, updated_at FROM foods;
    DROP TABLE foods;
    ALTER TABLE foods_new RENAME TO foods;
    CREATE INDEX foods_name_idx ON foods(name COLLATE NOCASE);
    CREATE UNIQUE INDEX foods_external_idx ON foods(provider, external_id) WHERE source = 'external';
    CREATE VIRTUAL TABLE food_search USING fts5(name, content='foods', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2');
    CREATE TRIGGER foods_search_insert AFTER INSERT ON foods BEGIN
      INSERT INTO food_search(rowid, name) VALUES (new.rowid, new.name);
    END;
    CREATE TRIGGER foods_search_delete AFTER DELETE ON foods BEGIN
      INSERT INTO food_search(food_search, rowid, name) VALUES ('delete', old.rowid, old.name);
    END;
    CREATE TRIGGER foods_search_update AFTER UPDATE ON foods BEGIN
      INSERT INTO food_search(food_search, rowid, name) VALUES ('delete', old.rowid, old.name);
      INSERT INTO food_search(rowid, name) VALUES (new.rowid, new.name);
    END;
    INSERT INTO food_search(food_search) VALUES ('rebuild');

    CREATE TABLE diary_new (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
      profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
      food_id TEXT REFERENCES foods(id) ON DELETE SET NULL,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      calories_per_100g REAL NOT NULL CHECK (calories_per_100g >= 0),
      protein_per_100g REAL CHECK (protein_per_100g >= 0),
      carbs_per_100g REAL CHECK (carbs_per_100g >= 0),
      fat_per_100g REAL CHECK (fat_per_100g >= 0),
      amount_g REAL NOT NULL CHECK (amount_g > 0), consumed_at TEXT NOT NULL, created_at TEXT NOT NULL
    );
    INSERT INTO diary_new SELECT * FROM diary_entries;
    DROP TABLE diary_entries;
    ALTER TABLE diary_new RENAME TO diary_entries;
    CREATE INDEX diary_profile_time_idx ON diary_entries(profile_id, consumed_at, id);
    CREATE INDEX diary_food_idx ON diary_entries(food_id);
    CREATE TABLE plans_new (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
      profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
      food_id TEXT REFERENCES foods(id) ON DELETE SET NULL,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      calories_per_100g REAL NOT NULL CHECK (calories_per_100g >= 0),
      protein_per_100g REAL CHECK (protein_per_100g >= 0),
      carbs_per_100g REAL CHECK (carbs_per_100g >= 0),
      fat_per_100g REAL CHECK (fat_per_100g >= 0),
      amount_g REAL NOT NULL CHECK (amount_g > 0), planned_at TEXT NOT NULL, created_at TEXT NOT NULL
    );
    INSERT INTO plans_new SELECT * FROM planned_meals;
    DROP TABLE planned_meals;
    ALTER TABLE plans_new RENAME TO planned_meals;
    CREATE INDEX plans_profile_time_idx ON planned_meals(profile_id, planned_at, id);
    CREATE INDEX plans_food_idx ON planned_meals(food_id);
  `,
}, {
  version: 4,
  sql: `
    CREATE TABLE diary_v4 (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
      profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
      food_id TEXT REFERENCES foods(id) ON DELETE SET NULL,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      source TEXT NOT NULL CHECK (source IN ('bundled', 'external', 'custom', 'unknown')),
      provider TEXT, external_id TEXT,
      serving_amount REAL NOT NULL CHECK (serving_amount > 0),
      serving_unit TEXT NOT NULL CHECK (serving_unit IN ('g', 'kg', 'oz', 'ml', 'cup', 'piece', 'serving')),
      calories REAL NOT NULL CHECK (calories >= 0),
      protein REAL CHECK (protein >= 0), carbohydrates REAL CHECK (carbohydrates >= 0), fat REAL CHECK (fat >= 0), notes TEXT,
      entry_date TEXT NOT NULL CHECK (length(entry_date) = 10 AND date(entry_date, '+0 days') IS NOT NULL AND date(entry_date, '+0 days') = entry_date),
      meal TEXT NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snacks')),
      quantity REAL NOT NULL CHECK (quantity > 0),
      quantity_mode TEXT NOT NULL CHECK (quantity_mode IN ('amount', 'servings')),
      total_calories REAL NOT NULL CHECK (total_calories >= 0),
      total_protein REAL CHECK (total_protein >= 0), total_carbohydrates REAL CHECK (total_carbohydrates >= 0), total_fat REAL CHECK (total_fat >= 0),
      consumed_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      amount_g REAL CHECK (amount_g > 0), calories_per_100g REAL CHECK (calories_per_100g >= 0),
      protein_per_100g REAL CHECK (protein_per_100g >= 0), carbs_per_100g REAL CHECK (carbs_per_100g >= 0), fat_per_100g REAL CHECK (fat_per_100g >= 0)
    );
    INSERT INTO diary_v4 (id, profile_id, food_id, name, source, provider, external_id,
      serving_amount, serving_unit, calories, protein, carbohydrates, fat,
      entry_date, meal, quantity, quantity_mode, total_calories, total_protein, total_carbohydrates, total_fat,
      consumed_at, created_at, updated_at, amount_g, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
    SELECT d.id, d.profile_id, d.food_id, d.name, coalesce(f.source, 'unknown'), f.provider, f.external_id,
      100, 'g', d.calories_per_100g, d.protein_per_100g, d.carbs_per_100g, d.fat_per_100g,
      substr(d.consumed_at, 1, 10), 'snacks', d.amount_g, 'amount',
      d.calories_per_100g * d.amount_g / 100, d.protein_per_100g * d.amount_g / 100,
      d.carbs_per_100g * d.amount_g / 100, d.fat_per_100g * d.amount_g / 100,
      d.consumed_at, d.created_at, d.created_at, d.amount_g,
      d.calories_per_100g, d.protein_per_100g, d.carbs_per_100g, d.fat_per_100g
      FROM diary_entries d LEFT JOIN foods f ON f.id = d.food_id;
    DROP TABLE diary_entries;
    ALTER TABLE diary_v4 RENAME TO diary_entries;
    CREATE INDEX diary_profile_date_meal_idx ON diary_entries(profile_id, entry_date, meal, created_at, id);
    CREATE INDEX diary_food_idx ON diary_entries(food_id);
  `,
}, {
  version: 5,
  sql: `
    CREATE TABLE plans_v5 (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
      profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
      food_id TEXT REFERENCES foods(id) ON DELETE SET NULL,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      source TEXT NOT NULL CHECK (source IN ('bundled', 'external', 'custom', 'unknown')),
      provider TEXT, external_id TEXT,
      serving_amount REAL NOT NULL CHECK (serving_amount > 0),
      serving_unit TEXT NOT NULL CHECK (serving_unit IN ('g', 'kg', 'oz', 'ml', 'cup', 'piece', 'serving')),
      calories REAL NOT NULL CHECK (calories >= 0),
      protein REAL CHECK (protein >= 0), carbohydrates REAL CHECK (carbohydrates >= 0), fat REAL CHECK (fat >= 0), notes TEXT,
      entry_date TEXT NOT NULL CHECK (length(entry_date) = 10 AND date(entry_date, '+0 days') IS NOT NULL AND date(entry_date, '+0 days') = entry_date),
      meal TEXT NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snacks')),
      quantity REAL NOT NULL CHECK (quantity > 0),
      quantity_mode TEXT NOT NULL CHECK (quantity_mode IN ('amount', 'servings')),
      total_calories REAL NOT NULL CHECK (total_calories >= 0),
      total_protein REAL CHECK (total_protein >= 0), total_carbohydrates REAL CHECK (total_carbohydrates >= 0), total_fat REAL CHECK (total_fat >= 0),
      planned_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      amount_g REAL CHECK (amount_g > 0), calories_per_100g REAL CHECK (calories_per_100g >= 0),
      protein_per_100g REAL CHECK (protein_per_100g >= 0), carbs_per_100g REAL CHECK (carbs_per_100g >= 0), fat_per_100g REAL CHECK (fat_per_100g >= 0),
      eaten_at TEXT, eaten_date TEXT CHECK (eaten_date IS NULL OR (date(eaten_date, '+0 days') IS NOT NULL AND date(eaten_date, '+0 days') = eaten_date)),
      diary_entry_id TEXT UNIQUE REFERENCES diary_entries(id) ON DELETE SET NULL,
      CHECK ((eaten_at IS NULL AND eaten_date IS NULL AND diary_entry_id IS NULL) OR (eaten_at IS NOT NULL AND eaten_date IS NOT NULL))
    );
    INSERT INTO plans_v5 (id, profile_id, food_id, name, source, provider, external_id,
      serving_amount, serving_unit, calories, protein, carbohydrates, fat,
      entry_date, meal, quantity, quantity_mode, total_calories, total_protein, total_carbohydrates, total_fat,
      planned_at, created_at, updated_at, amount_g, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
    SELECT p.id, p.profile_id, p.food_id, p.name, coalesce(f.source, 'unknown'), f.provider, f.external_id,
      100, 'g', p.calories_per_100g, p.protein_per_100g, p.carbs_per_100g, p.fat_per_100g,
      substr(p.planned_at, 1, 10), 'snacks', p.amount_g, 'amount',
      p.calories_per_100g * p.amount_g / 100, p.protein_per_100g * p.amount_g / 100,
      p.carbs_per_100g * p.amount_g / 100, p.fat_per_100g * p.amount_g / 100,
      p.planned_at, p.created_at, p.created_at, p.amount_g,
      p.calories_per_100g, p.protein_per_100g, p.carbs_per_100g, p.fat_per_100g
      FROM planned_meals p LEFT JOIN foods f ON f.id = p.food_id;
    DROP TABLE planned_meals;
    ALTER TABLE plans_v5 RENAME TO planned_meals;
    CREATE INDEX plans_profile_date_meal_idx ON planned_meals(profile_id, entry_date, meal, created_at, id);
    CREATE INDEX plans_food_idx ON planned_meals(food_id);
    CREATE TRIGGER plans_eaten_update BEFORE UPDATE ON planned_meals WHEN old.eaten_at IS NOT NULL
      AND (new.eaten_at IS NOT old.eaten_at OR new.eaten_date IS NOT old.eaten_date OR
        new.entry_date IS NOT old.entry_date OR new.meal IS NOT old.meal OR
        new.quantity IS NOT old.quantity OR new.quantity_mode IS NOT old.quantity_mode OR
        new.total_calories IS NOT old.total_calories)
      BEGIN SELECT RAISE(ABORT, 'Eaten plans are read-only'); END;
    CREATE TRIGGER plans_eaten_delete BEFORE DELETE ON planned_meals WHEN old.eaten_at IS NOT NULL
      BEGIN SELECT RAISE(ABORT, 'Eaten plans are retained as history'); END;
  `,
}, {
  version: 6,
  sql: `
    CREATE TABLE weights_v6 (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
      profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
      weight_kg REAL NOT NULL CHECK (weight_kg > 0),
      measured_date TEXT NOT NULL CHECK (length(measured_date) = 10 AND date(measured_date, '+0 days') IS NOT NULL AND date(measured_date, '+0 days') = measured_date),
      measured_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    INSERT INTO weights_v6 (id, profile_id, weight_kg, measured_date, measured_at, created_at, updated_at)
      SELECT id, profile_id, weight_kg, substr(measured_at, 1, 10), measured_at, created_at, created_at FROM weight_history;
    DROP TABLE weight_history;
    ALTER TABLE weights_v6 RENAME TO weight_history;
    CREATE INDEX weight_profile_time_idx ON weight_history(profile_id, measured_at, id);
    CREATE INDEX weight_profile_date_idx ON weight_history(profile_id, measured_date, id);
    CREATE TABLE calorie_target_history (
      profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
      effective_date TEXT NOT NULL CHECK (length(effective_date) = 10 AND date(effective_date, '+0 days') IS NOT NULL AND date(effective_date, '+0 days') = effective_date),
      target INTEGER CHECK (target > 0 AND target = CAST(target AS INTEGER)),
      recorded_at TEXT NOT NULL,
      PRIMARY KEY (profile_id, effective_date)
    );
  `,
}, {
  version: 7,
  sql: `
    ALTER TABLE foods ADD COLUMN cuisine TEXT CHECK (cuisine IN ('myanmar', 'japanese', 'western', 'chinese'));
    CREATE INDEX foods_cuisine_name_idx ON foods(cuisine, name COLLATE NOCASE, id);
  `,
}] as const;

export async function initializeDatabase(db: Database) {
  // Table rebuilds need foreign keys disabled outside the transaction. Startup gates
  // repository access; validate all references before committing and restore enforcement.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = OFF; PRAGMA busy_timeout = 5000;');
  try {
    await db.withExclusiveTransactionAsync(async (tx) => {
      const row = await tx.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      const version = row?.user_version ?? 0;
      if (version > migrations[migrations.length - 1].version) {
        throw new Error('This database requires a newer version of the app.');
      }
      for (const migration of migrations) {
        if (migration.version > version) {
          await tx.execAsync(migration.sql);
          if (migration.version === 3) {
            const existing = await tx.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM foods ORDER BY id');
            const keys = new Set<string>();
            for (const food of existing) {
              const searchKey = normalizeFoodName(food.name);
              const key = JSON.stringify([searchKey, 100, 'g']);
              // Grandfather old duplicates without deleting records or breaking diary links.
              await tx.runAsync('UPDATE foods SET search_key = ?, dedupe_key = ? WHERE id = ?', searchKey, keys.has(key) ? null : key, food.id);
              keys.add(key);
            }
            for (const food of developmentFoods) await insertBundledFood(tx, food.id, food);
          }
          if (migration.version === 4) {
            const entries = await tx.getAllAsync<{ id: string; consumed_at: string }>('SELECT id, consumed_at FROM diary_entries');
            // Old entries had only an instant. Resolve their day in the current device
            // timezone once, then retain that calendar date when the user travels.
            for (const entry of entries) await tx.runAsync('UPDATE diary_entries SET entry_date = ? WHERE id = ?',
              localCalendarDate(new Date(entry.consumed_at)), entry.id);
          }
          if (migration.version === 5) {
            const plans = await tx.getAllAsync<{ id: string; planned_at: string }>('SELECT id, planned_at FROM planned_meals');
            for (const plan of plans) await tx.runAsync('UPDATE planned_meals SET entry_date = ? WHERE id = ?',
              localCalendarDate(new Date(plan.planned_at)), plan.id);
          }
          if (migration.version === 6) {
            const weights = await tx.getAllAsync<{ id: string; measured_at: string }>('SELECT id, measured_at FROM weight_history');
            for (const weight of weights) await tx.runAsync('UPDATE weight_history SET measured_date = ? WHERE id = ?',
              localCalendarDate(new Date(weight.measured_at)), weight.id);
            // Prior versions did not retain targets. Start history now, never backfill guesses.
            const time = new Date().toISOString();
            await recordCurrentTarget(tx, localCalendarDate(new Date(time)), time);
          }
          // Only trusted migration constants are interpolated, never user input.
          await tx.execAsync(`PRAGMA user_version = ${migration.version}`);
        }
      }
      const violations = await tx.getAllAsync('PRAGMA foreign_key_check');
      if (violations.length) throw new Error('Database contains invalid references.');
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
}
