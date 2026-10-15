import myanmar from './catalog/myanmar.json' with { type: 'json' };
import japanese from './catalog/japanese.json' with { type: 'json' };
import western from './catalog/western.json' with { type: 'json' };
import chinese from './catalog/chinese.json' with { type: 'json' };
import type { Database } from './database.ts';
import { importFoodCatalog } from './importFoodCatalog.ts';

export const bundledFoodCatalog = { schema_version: 1, foods: [...myanmar.foods, ...japanese.foods, ...western.foods, ...chinese.foods] };

export function seedBundledFoodCatalog(db: Database) {
  return importFoodCatalog(db, bundledFoodCatalog);
}
