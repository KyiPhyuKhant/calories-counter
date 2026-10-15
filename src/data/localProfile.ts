import type { SqlExecutor } from './database.ts';

export async function profileForLogging(tx: SqlExecutor, newId: () => string, now: () => string, requested?: string) {
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
