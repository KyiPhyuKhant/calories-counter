import myanmar from './catalog/myanmar.json' with { type: 'json' };
import type { Database } from './database.ts';
import { importFoodCatalog } from './importFoodCatalog.ts';

export const bundledFoodCatalog = { schema_version: 1, foods: [...myanmar.foods] };

export function seedBundledFoodCatalog(db: Database) {
  return importFoodCatalog(db, bundledFoodCatalog);
}
