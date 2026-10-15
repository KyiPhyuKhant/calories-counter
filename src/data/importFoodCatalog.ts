import type { FoodInput } from '../domain/food.ts';
import { validateFood } from '../domain/food.ts';
import type { Database } from './database.ts';
import { foodColumns, foodValues } from './foodRepository.ts';
import { metadataColumns, metadataValues } from './foodMetadata.ts';

export type CatalogFood = FoodInput & { id: string };

export function parseFoodCatalog(value: unknown): CatalogFood[] {
  if (!value || typeof value !== 'object' || !('schema_version' in value) || value.schema_version !== 1 || !('foods' in value) || !Array.isArray(value.foods)) throw new Error('Unsupported food catalog.');
  const ids = new Set<string>();
  return value.foods.map((row: unknown) => {
    if (!row || typeof row !== 'object') throw new Error('Invalid catalog food.');
    const food = row as CatalogFood;
    if (typeof food.id !== 'string' || !/^catalog:[a-z0-9:-]+$/.test(food.id) || food.id.length > 200 || ids.has(food.id)) throw new Error('Catalog IDs must be stable and unique.');
    if (typeof food.name !== 'string' || (food.calories !== null && typeof food.calories !== 'number') || (food.notes != null && typeof food.notes !== 'string')) throw new Error('Invalid catalog food fields.');
    const errors = validateFood(food);
    if (Object.keys(errors).length) throw new Error(`Invalid catalog food ${food.id}: ${Object.values(errors).join(' ')}`);
    ids.add(food.id);
    return { ...food };
  });
}

export async function importFoodCatalog(db: Database, manifest: unknown, now = () => new Date().toISOString()) {
  const foods = parseFoodCatalog(manifest);
  let inserted = 0;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const time = now();
    for (const food of foods) {
      const result = await tx.runAsync(`INSERT INTO foods (id, ${foodColumns}, cuisine, ${metadataColumns}, source, created_at, updated_at)
        VALUES (${Array(21).fill('?').join(', ')}, 'bundled', ?, ?) ON CONFLICT(id) DO NOTHING`,
      food.id, ...foodValues(food), food.cuisine ?? null, ...metadataValues(food), time, time);
      inserted += result.changes;
    }
  });
  return { inserted, skipped: foods.length - inserted };
}
