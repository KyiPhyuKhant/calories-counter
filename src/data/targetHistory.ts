import type { SqlExecutor } from './database.ts';
import type { Profile } from './repositories.ts';
import { summarizeDashboard } from '../domain/dashboard.ts';

export async function recordCurrentTarget(tx: SqlExecutor, date: string, time: string) {
  const profile = await tx.getFirstAsync<Profile>('SELECT * FROM user_profiles WHERE singleton = 1');
  if (!profile) return;
  const target = summarizeDashboard(profile, []).progress?.target ?? null;
  // The final saved target for a local day applies until the next dated change.
  await tx.runAsync(`INSERT INTO calorie_target_history (profile_id, effective_date, target, recorded_at)
    VALUES (?, ?, ?, ?) ON CONFLICT(profile_id, effective_date) DO UPDATE SET target = excluded.target, recorded_at = excluded.recorded_at`,
  profile.id, date, target, time);
}
