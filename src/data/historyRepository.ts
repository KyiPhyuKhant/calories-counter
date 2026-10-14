import type { Database } from './database.ts';
import { localCalendarDate } from '../domain/diary.ts';
import { buildHistory, historyRange, type DailyConsumption, type HistoryPeriod, type TargetChange } from '../domain/history.ts';
import type { WeightEntry } from './weightRepository.ts';

export function createHistoryRepository(db: Database, now: () => string) {
  return {
    async getPeriod(anchor: string, period: HistoryPeriod) {
      const range = historyRange(anchor, period);
      let consumption: DailyConsumption[] = [];
      let weights: WeightEntry[] = [];
      let targets: TargetChange[] = [];
      await db.withExclusiveTransactionAsync(async (tx) => {
        consumption = await tx.getAllAsync<DailyConsumption>(`SELECT entry_date AS date, sum(total_calories) AS calories, count(*) AS entry_count
          FROM diary_entries WHERE profile_id = (SELECT id FROM user_profiles WHERE singleton = 1)
          AND entry_date BETWEEN ? AND ? GROUP BY entry_date ORDER BY entry_date`, range.start, range.end);
        weights = await tx.getAllAsync<WeightEntry>(`SELECT * FROM weight_history WHERE profile_id = (SELECT id FROM user_profiles WHERE singleton = 1)
          AND measured_date BETWEEN ? AND ? ORDER BY measured_date DESC, measured_at DESC, id`, range.start, range.end);
        targets = await tx.getAllAsync<TargetChange>(`SELECT effective_date, target FROM calorie_target_history
          WHERE profile_id = (SELECT id FROM user_profiles WHERE singleton = 1) AND effective_date <= ? ORDER BY effective_date`, range.end);
      });
      return { ...buildHistory(range, localCalendarDate(new Date(now())), consumption, weights, targets), weights };
    },
  };
}
