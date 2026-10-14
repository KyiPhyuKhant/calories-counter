import type { Database, SqlExecutor } from './database.ts';
import { localCalendarDate } from '../domain/diary.ts';
import { validateWeight } from '../domain/history.ts';

export interface WeightEntry {
  id: string; profile_id: string; weight_kg: number; measured_date: string;
  measured_at: string; created_at: string; updated_at: string;
}

export function createWeightRepository(db: Database, newId: () => string, now: () => string) {
  const today = () => localCalendarDate(new Date(now()));
  async function insert(tx: SqlExecutor, date: string, weight: number, requestedProfile?: string, measuredAt = now()) {
    validateWeight(date, weight, today());
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
    const id = newId(); const time = now();
    await tx.runAsync(`INSERT INTO weight_history (id, profile_id, weight_kg, measured_date, measured_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, id, profileId, weight, date, measuredAt, time, time);
    return id;
  }
  return {
    get: (id: string) => db.getFirstAsync<WeightEntry>('SELECT * FROM weight_history WHERE id = ?', id),
    list: (profileId: string) => db.getAllAsync<WeightEntry>('SELECT * FROM weight_history WHERE profile_id = ? ORDER BY measured_date DESC, measured_at DESC, id', profileId),
    async create(date: string, weight: number) {
      validateWeight(date, weight, today());
      let id = '';
      await db.withExclusiveTransactionAsync(async (tx) => { id = await insert(tx, date, weight); });
      return id;
    },
    async update(id: string, date: string, weight: number) {
      validateWeight(date, weight, today());
      const result = await db.runAsync('UPDATE weight_history SET measured_date = ?, weight_kg = ?, updated_at = ? WHERE id = ?', date, weight, now(), id);
      if (result.changes !== 1) throw new Error('Weight entry not found.');
    },
    async remove(id: string) {
      if ((await db.runAsync('DELETE FROM weight_history WHERE id = ?', id)).changes !== 1) throw new Error('Weight entry not found.');
    },
    // Existing callers record an instant; resolve its local date exactly once.
    async add(profileId: string, weight: number, measuredAt: string) {
      const date = localCalendarDate(new Date(measuredAt)); let id = '';
      await db.withExclusiveTransactionAsync(async (tx) => { id = await insert(tx, date, weight, profileId, new Date(measuredAt).toISOString()); });
      return id;
    },
  };
}
