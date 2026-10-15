# Local Navigation

## Sitemap

The root stack exposes either onboarding or the main tabs after SQLite and the
local profile have loaded. The setup guard is not authentication. There are no
login, signup, account, backend, or cloud-sync routes or dependencies.

| Tab | Root URL | Nested stack destinations |
| --- | --- | --- |
| Home | `/` | Dashboard |
| Diary | `/diary` | `/diary/select`, `/diary/edit`, `/diary/custom-food` |
| Foods | `/foods` | `/foods/[id]`, `/foods/edit` |
| Plan | `/plans` | `/plans/select`, `/plans/edit`, `/plans/custom-food` |
| Profile | `/profile` | `/edit-profile`, `/goal-settings`, `/history`, `/history/calories`, `/history/weight`, `/settings` |

Pathless `(tabs)` and `(profile)` groups preserve the existing public URLs.
Detail and form screens live inside their owning tab stacks so the same five
tabs remain available. Native headers handle top safe areas; the tab navigator
handles the bottom inset. Home handles its top inset because it has no header.
Detail headers offer Back and Home, including a Home fallback for direct links.
Home switches tabs without pushing another Home route. Stack anchors provide
the owning root when opening a detail URL directly.

Selecting a food from Diary or Plan retains the selected local date and meal.
Creating a custom food from those flows stays in that tab and continues to the
quantity form. Existing custom-food details and editing remain under Foods.
Profile links to both history graphs, profile editing, calorie-goal settings,
and a read-only App Settings screen showing the current local configuration.
Appearance remains light-only, matching the existing app configuration.

## First Launch

`/onboarding` -> `/onboarding/profile` -> `/onboarding/activity` ->
`/onboarding/target` -> `/`

Completion is derived from all persisted required profile fields and the
existing calorie validator, including manual-target safety limits. A skeletal
profile previously created for diary or weight logging is not completed setup.
Existing valid profiles go directly to Home. Loading or read failures never
briefly display the wrong navigator; failures offer retry without erasing data.

The onboarding draft stays in memory across Back navigation. It is saved only
when Start tracking is pressed on the target result. That write uses the existing
profile repository and retains the existing profile ID, diary entries, plans,
measurements, and nutrition snapshots. No schema or calculation changes are
needed. Successful persistence updates the root guard, removes onboarding from
navigation history, and opens Home. Repeated presses are guarded while saving;
failed writes keep the draft and allow retry. Quitting before finishing restarts
setup from the persisted profile; unfinished drafts are not saved.

Deep links cannot bypass incomplete setup. This is a local onboarding policy,
not an account or security boundary. The bottom tabs are intentionally absent
during onboarding.

## Verification

```sh
npm run typecheck
npm test
npm run lint
npx expo export --platform ios --output-dir /tmp/calories-navigation-export
npm run ios -- --port 8088 --clear
```

Navigation tests exercise the production layout components through host mocks,
not native taps. Tests cover tab order, nested destinations, setup guards,
incomplete deep links, explicit final save, rapid-press protection, failed-save
retry, custom-food flow continuity, and SQLite data preservation. The full suite
also verifies calorie calculations, date boundaries, snapshots, plan conversion,
history, and persistence across a process restart.

On 2026-10-15, TypeScript, lint, all 87 tests, and the iOS bundle export passed.
Expo Go started on an iPhone 16 Pro simulator (iOS 18.6). Welcome and Profile
Setup were inspected with the real incomplete-profile guard. A temporary
read-only guard override allowed inspection of Home's five tabs, Diary's Add
Food stack, Profile, and Calorie History without writing a sample profile or
changing local records. That override was removed before final validation.
These screenshot/startup checks are not a complete native interaction test.

Manual acceptance on a simulator or physical iPhone should still cover a full
onboarding form journey, returning after restart, tab switching while editing,
Back/Home gestures, keyboard dismissal, and VoiceOver. Do not delete a real
database to test first launch; use a separate simulator or development install.
