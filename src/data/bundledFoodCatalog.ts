import myanmar from './catalog/myanmar.json' with { type: 'json' };
import japanese from './catalog/japanese.json' with { type: 'json' };
import type { Database } from './database.ts';
import { importFoodCatalog } from './importFoodCatalog.ts';

export const bundledFoodCatalog = { schema_version: 1, foods: [...myanmar.foods, ...japanese.foods] };

export function seedBundledFoodCatalog(db: Database) {
  return importFoodCatalog(db, bundledFoodCatalog);
}
