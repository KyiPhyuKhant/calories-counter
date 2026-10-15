# Multicultural Food Catalog

## Data And Import

The user-supplied `multicultural_food_catalog.json` is split by cuisine under
`src/data/catalog/`, starting with Myanmar. The original names, stable IDs,
serving amounts, notes, image references, and null nutrition values are retained.
These are catalog metadata, not verified nutrition or validated portions.
The Myanmar and Japanese stages each add the 30 supplied dishes with native names.
The Western stage adds 30 supplied dishes; native names are unavailable in that data.
The Chinese stage adds 30 supplied dishes with their Chinese names and stable IDs.

`DatabaseProvider` runs migrations and then `seedBundledFoodCatalog` before
exposing repositories or screens. `importFoodCatalog` validates the manifest,
inserts it transactionally, and uses `ON CONFLICT(id) DO NOTHING`. A repeat
import never replaces an existing row, including a custom food using the same
ID. An interrupted import rolls back and can be retried. No connection, account,
API key, network request, or server is involved.

Migration 8 rebuilds only `foods` to allow null calories and store `native_name`,
JSON aliases, dish/ingredient category, nutrition source/status, and optional
image filename. It preserves original IDs, rowids, nutrition, custom duplicate
keys, cuisine, timestamps, indexes, and related records. Diary and plan tables
keep numeric snapshots and are not rebuilt or rewritten.

## Unknown Nutrition

Unknown calories and macros stay `null`, never zero. A supplied zero remains a
real zero. Unknown foods can be browsed but cannot be logged or planned, even
through repository methods or direct entry links. The calculation/snapshot layer
rejects unknown calories before any consumed or planned record can be committed.

Imported serving amounts are placeholders, not confirmed portions. The JSON
contains no source-backed calorie values. Original development examples remain
separate, labeled as invented, with their existing IDs and history intact.
They are not used to fill missing nutrition in the imported catalog.

Use a food's Create personal version action to create a custom food with your
own measured serving and supplied nutrition. This never edits the bundled food.
Custom forms accept an optional source, native name, alternative/romanized names,
and unknown calories. User-entered values are not automatically labeled verified.
An empty calorie value must be filled before that version can be logged.

## Search And Images

SQLite FTS5 indexes English names, native names, and aliases using Unicode letter,
number, and combining-mark categories. NFKC normalization supports full-width
queries. Existing cuisine filters, deterministic pagination, source labels, and
offline custom-food search remain available. The supplied alias arrays are empty;
romanized searches work for names already present in English or explicitly added
as aliases. There is no automatic transliteration or translation.

`src/data/foodImages.ts` is the static, exact-filename asset registry required by
Metro. No food PNGs were present when this implementation was inspected. All
missing or unregistered references use the same square utensil placeholder.
No remote, stock, or unrelated images are substituted. To add a verified matching
local PNG, add a literal `require` entry for its exact filename in that registry.
Inspect the actual food pictured, not just the filename; for example, a prepared
oatmeal photo must not stand in for raw oats.

## Measured Recipes

`calculateRecipeNutrition` in `src/domain/recipe.ts` scales ingredient nutrition
by measured quantities, sums the batch, then scales against measured cooked yield
and the requested serving. Include retained oil, sauces, and other ingredients.
Unknown ingredient calories or invented development data are rejected; missing
macros propagate as unknown. Unsupported unit conversions require a real
food-specific conversion, never an assumed density. Retained ingredient
quantities and yield must reflect cooking/discarded liquids and fats.

This is a pure calculation API, not a visual recipe builder. Its output can be
saved as a custom food using the existing repository with the measured serving,
recipe notes, and `nutrition_status: 'recipe'`. Results apply to that recipe and
portion only, not to every restaurant or homemade version of the dish.

## Checks

```sh
npm run typecheck
npm test
npm run lint
npx expo export --platform ios --output-dir /tmp/calories-catalog-export
```

Tests cover seed validation, stable-ID conflicts, repeat imports, rollback,
Unicode and alias search, cuisine filters, null versus zero nutrition, blocked
logging/planning, custom versions, recipe math, and reopen persistence. Upgrade
tests verify old food IDs and rowids, diary snapshots, plan/eaten receipts,
targets, and foreign keys survive migration 8, including an interrupted upgrade.
Restart the app to run startup migrations and seeding; never reset a real database.
