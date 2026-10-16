import type { Database } from './database.ts';

export const eatenPlanDeleteTrigger = `CREATE TRIGGER plans_eaten_delete BEFORE DELETE ON planned_meals WHEN old.eaten_at IS NOT NULL
  BEGIN SELECT RAISE(ABORT, 'Eaten plans are retained as history'); END;`;

export async function clearAppData(db: Database) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    // Only a full reset may remove eaten plans. Restore their protection before commit.
    await tx.execAsync('DROP TRIGGER plans_eaten_delete;');
    await tx.execAsync(`
      DELETE FROM planned_meals;
      DELETE FROM diary_entries;
      DELETE FROM weight_history;
      DELETE FROM calorie_target_history;
      DELETE FROM user_profiles;
      DELETE FROM foods;
    `);
    await tx.execAsync(eatenPlanDeleteTrigger);
  });
}
