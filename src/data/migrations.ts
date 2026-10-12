import type { Database } from './database.ts';

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
}] as const;

export async function initializeDatabase(db: Database) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  await db.withExclusiveTransactionAsync(async (tx) => {
    const row = await tx.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const version = row?.user_version ?? 0;
    if (version > migrations[migrations.length - 1].version) {
      throw new Error('This database requires a newer version of the app.');
    }
    for (const migration of migrations) {
      if (migration.version > version) {
        await tx.execAsync(migration.sql);
        // Only trusted migration constants are interpolated, never user input.
        await tx.execAsync(`PRAGMA user_version = ${migration.version}`);
      }
    }
  });
}
