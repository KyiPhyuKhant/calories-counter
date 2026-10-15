# Step 10 Validation

Validation date: 2026-10-15 (Asia/Tokyo). This record distinguishes production
repository tests from native UI testing. No user data was reset or seeded.

## Automated checks

- `npm run typecheck`: strict TypeScript validation.
- `npm run lint`: Expo ESLint validation.
- `npm test`: 66 passing tests against pure functions and real Node SQLite.
- `npx expo install --check`: passed; the recommended SDK 57
  patch updates were applied to Expo, Constants, Linking and Router.
- `npx expo export --dev --platform ios --output-dir /tmp/calories-step10-ios-export`:
  development iOS bundle and asset export. This is not an Xcode binary build.

Existing coverage verifies:

- First-use profile absence, saved profile edits, BMR/TDEE estimates, manual
  targets, adult-only validation and target guardrails.
- Offline food FTS search, custom-food CRUD, duplicates, serving conversions,
  source labels and unknown optional nutrients.
- Diary creation, editing, deletion, meal/day totals and immutable snapshots.
- Dashboard under/at/over-target results, committed-change notifications and
  exclusion of planned meals.
- Planning CRUD, atomic copying, snapshot preservation, conversion to diary
  entries, duplicate prevention and transaction rollback.
- Weight CRUD, daily means, profile-weight independence, dated calorie targets,
  weekly/monthly summaries and chart geometry with missing values.
- Database migrations, foreign keys, failed-upgrade rollback and reopen persistence.

New tests verify locale-friendly numeric parsing without bypassing domain bounds;
Gregorian date labels independent of native calendar overrides; and calendar
boundaries in Tokyo, Los Angeles, Kiritimati and Pago Pago.

The new offline journey runs in two separate Node processes. It creates and edits
a profile, searches bundled foods, creates/edits/deletes custom foods, edits and
deletes diary entries, plans/copies meals, preserves food snapshots after catalog
deletion, logs a planned meal idempotently, and edits/deletes weight measurements.
It then restarts with the same on-disk database in a different timezone and checks
IDs, dates, food search, dashboard totals, history, eaten receipts, foreign keys
and database integrity. `fetch` is disabled in both processes. This verifies
repository persistence and offline operation, not the Expo native bridge or
airplane-mode behavior on a physical iPhone.

## Native validation scope

The environment has Xcode 26.0.1 and an iPhone 16 Pro simulator on iOS 18.6.
Expo Go startup and iOS bundling passed using `npm run ios -- --port 8088`.
Screenshots inspected the profile, monthly calorie-history empty state and
weight form, including the accessibility-large text setting. The original
simulator text setting was restored after checking it. A leap-day diary label
was verified as `29 Feb 2024`, rather than the device's Buddhist-calendar year.
An invalid-date deep link also displayed its error and Go to today recovery action.
These checks do not prove that every interactive workflow has been completed.

The actual simulator database passed read-only SQLite `PRAGMA quick_check` and
`PRAGMA foreign_key_check` before and after force-quitting/reopening Expo Go.
Counts remained unchanged: four bundled foods, no profiles, diary entries,
plans or weights. This checks native initialization and clean-start persistence,
not a populated native CRUD/restart workflow. No simulator data was seeded.

No standalone signed iOS build, physical iPhone test, VoiceOver interaction,
or fully automated native UI suite has been completed. Native keyboard behavior,
chart tapping and all form workflows still require the checklist below.

## Remaining limitations

- Light theme only, as configured in `app.json`; dark mode was not introduced.
- Food catalog and custom foods work locally. Real online food search remains
  intentionally removed, and development sample nutrition is not verified data.
- `npm audit --json` reports 29 dependency warnings (19 high, 10 moderate),
  including transitive Expo/Metro tooling and Router decoding dependencies.
  These are advisory reports, not a validated exploitability assessment. No
  forced dependency downgrade or incompatible SDK upgrade was performed.
- Node prints existing `MODULE_TYPELESS_PACKAGE_JSON` warnings while importing
  TypeScript in tests. Tests still complete; package module semantics were not
  changed just to suppress the warnings.
- Expo Go must support SDK 57. A development build is needed otherwise.
- Expo Go needs a development server when loading/reloading the JS bundle.
  Test offline cold startup with an installed standalone/development build that
  actually contains a usable bundle, not by assuming Metro works without a network.

## Manual iPhone Checklist

These items are pending manual verification unless separately recorded:

1. On a clean install, use Home's Set calorie target action. Enter a valid adult
   profile, try invalid fields, save, reopen and edit the manual target.
2. On iPhone 14 and a smaller screen, focus the last field in every form. Check
   keyboard scrolling, decimal commas, Done, Save, safe areas and large text.
3. Search local foods; create, edit and delete a clearly labeled test custom food.
   Try duplicates and invalid servings. Verify errors retain the entered data.
4. Log foods into all meals. Change quantities and dates, delete an entry and
   check the home totals immediately. Edit a catalog food and confirm logged
   nutrition remains unchanged.
5. Plan tomorrow's meals and confirm consumed totals do not change. Copy to an
   empty date, log a planned meal as eaten and repeat the action to check that
   it does not log twice. Verify receipts after deleting the linked diary entry.
6. Add, edit and delete weights. Verify current profile weight stays unchanged.
   Inspect weekly/monthly graphs, tap days, use the graph-day arrows and expand
   Measurements. Check missing dates and unknown historical targets.
7. Force-quit and reopen the app without uninstalling it. Confirm all saved data
   and the plan's eaten state survive. Enable airplane mode after loading and
   repeat local operations; separately check cold launch in a bundled build.
8. Change the device timezone across midnight, then restore it. Saved diary and
   weight dates must not move. New timestamps/daily targets follow local time.
9. Turn on VoiceOver and larger accessibility text. Verify field/error labels,
   Back/Home navigation, chart descriptions, disabled controls and tap targets.

## Commands

```sh
npm ci
npm run typecheck
npm run lint
npm test
npx expo install --check
npm run ios -- --port 8088
```

For iPhone testing, run `npm start -- --lan --port 8088` on the Mac and scan its
QR code with a compatible Expo Go installation on the same Wi-Fi. Allow local
network permission if asked. If port 8088 is occupied, choose another port.
No food-provider credentials or app account are needed. Xcode is required for
the simulator; standalone physical-device builds also need signing/provisioning.
