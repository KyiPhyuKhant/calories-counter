# Multicultural Food Catalog

## Data And Import

The user-supplied `multicultural_food_catalog.json` is split by cuisine under
`src/data/catalog/`, starting with Myanmar. The original names, stable IDs,
serving amounts, notes, image references, and null nutrition values are retained.
These are catalog metadata, not verified nutrition or validated portions.
The Myanmar and Japanese stages each add the 30 supplied dishes with native names.
The Western stage adds 30 supplied dishes; native names are unavailable in that data.
The Chinese stage adds 30 supplied dishes with their Chinese names and stable IDs.
The final common-ingredient stage adds 30 uncategorized foods, completing all 150
attachment records: 30 Myanmar, 30 Japanese, 30 Western, 30 Chinese, and 30 common
ingredients. All 150 have unavailable calories and macros in the supplied data.

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
The compact Myanmar custom form retains the copied source, native name, aliases,
and other hidden metadata rather than exposing separate fields for them.
User-entered values are not automatically labeled verified.
An empty calorie value must be filled before that version can be logged.

## Search And Images

SQLite FTS5 indexes English names, native names, and aliases using Unicode letter,
number, and combining-mark categories. NFKC normalization supports full-width
queries. Existing cuisine filters, deterministic pagination, source labels, and
offline custom-food search remain available. The supplied alias arrays are empty;
romanized searches work for names already present in English or explicitly added
as aliases. There is no automatic transliteration or translation.

## Myanmar Food UI

Food Library, food details, add/edit forms, food selection, diary, meal planning,
and their shared navigation/date/unit controls use Myanmar UI copy. Food names
display their stored Myanmar native name where available, otherwise the original
food name. No second English/Japanese/Chinese translation is shown beside it.
Legacy diary names can use the supplied catalog's known Myanmar display name,
without rewriting stored snapshot names or nutrition.

The form exposes only name, cuisine, calories, amount, and unit. Its buttons save,
cancel, and (for an existing custom food) delete. Existing English search names,
aliases, macros, notes, sources, categories, image references, and unknown values
are retained behind the simplified form. Editing a Myanmar display name retains
the English search name. Explicit English renames keep previous search names as
aliases when space is available. Existing aliases are never removed to make room.
Changing calorie/serving data marks the result user-entered, not source-verified.

The four visible unit choices are grams, milliliters, servings, and pieces.
Preexisting kilogram, ounce, and cup records retain their unit unless the user
explicitly selects another unit. Internal cuisine/unit IDs, SQLite schema, seed
records, recipe math, calorie calculations, and historical snapshots are unchanged.

Numeric fields accept Myanmar digits as well as the existing Latin/full-width
digits and decimal-separator handling, subject to the same validation limits.
Errors are localized at the presentation boundary; repository/domain errors keep
their existing contracts. Stored user notes and source references are not machine
translated or deleted. Other profile/onboarding/history screens are not part of
this food-screen localization pass.

Text controls use natural line metrics so Myanmar combining marks and Dynamic
Type do not clip against fixed line boxes. Form action buttons stack at larger
accessibility text sizes. Shared Back/Home controls use familiar icons with
Myanmar accessibility labels, leaving more room for native header titles.

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

Validation on 2026-10-15:

| Stage | TypeScript | Tests | Lint |
| --- | --- | --- | --- |
| Myanmar and import infrastructure | Pass | 107 passed | Pass |
| Japanese | Pass | 108 passed | Pass |
| Western | Pass | 109 passed | Pass |
| Chinese | Pass | 110 passed | Pass |
| Common ingredients, complete attachment | Pass | 111 passed | Pass |

A structured comparison confirmed that all 150 combined records exactly match
the supplied JSON. The final iOS bundle export passed. Expo Go on an iPhone 16 Pro
simulator (iOS 18.6) opened successfully after native SQLite migration and seeding.
The Foods list, Mohinga's Myanmar-name detail screen, and personal-version form
were inspected through deep links without writing test diary/profile data or
bypassing onboarding. Physical-device interaction, VoiceOver, keyboard editing,
and saving the personal-version form still need manual acceptance testing.

Myanmar food-screen update, validated on 2026-10-15:

- `npm run typecheck`: passed.
- `npm test`: 122 passed, 0 failed, including simplified-form preservation,
  Myanmar/English search, numeric input, labels, and unchanged diary snapshots.
- `npm run lint`: passed without lint warnings.
- `npx expo export --platform ios --output-dir /tmp/calories-myanmar-ui-export`:
  passed. Existing Node module-type and export color-environment warnings remain.
- Expo Go on the iPhone 16 Pro simulator: library, personal-version form, diary,
  and plan screens opened through deep links. Myanmar rendering was inspected
  at normal and accessibility text sizes; clipping in form controls was fixed.
  The simulator text size was restored afterward. No native form saves or
  deletions were performed during these visual checks.
- Physical-device keyboard editing, save/delete interactions, and VoiceOver
  still require manual acceptance testing. No schema or migration changes were
  needed, and no installed dependencies were added.
