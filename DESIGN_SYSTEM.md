# UI Design System

Step 11 introduces shared UI foundations based on the supplied storyboard, not a
replacement app or a full screen redesign. There are no new runtime dependencies,
database migrations, accounts, nutrition records or business-rule changes.
The existing light-only configuration is preserved.

## Tokens

`src/theme/theme.ts` is the source of truth:

| Token | Value | Purpose |
| --- | --- | --- |
| background / surface | `#FFFFFF` | Screens and cards |
| primary | `#2F9E68` | Primary actions and progress |
| accentSurface | `#EAF7EF` | Soft green surfaces |
| text / onPrimary | `#14213D` | Navy text, including on primary green |
| surfaceMuted | `#F5F6F8` | Search and segmented-control backgrounds |
| accent | `#20754C` | Accessible green foregrounds and legacy filled buttons |
| secondaryText | `#566176` | Secondary text |

Navy primary-button labels and darker green links maintain normal-text contrast
of at least 4.5:1; white text on the brighter reference green does not.
Danger, warning and planning colors are separate semantic tokens.

Spacing follows a 4/8/12/16/24/32 scale. Controls use a 12px radius, cards 16px,
and inset selections 8px. Native system fonts, consistent type styles and a subtle
card shadow complete the foundation. Dynamic Type remains enabled, text wraps,
and controls have at least a 44-point touch height.

## Components

Import components directly from `src/components/ui/`:

| Component | Main props | Notes |
| --- | --- | --- |
| AppButton | title, onPress, icon, variant, disabled, loading | Primary, secondary, ghost and danger; accessible busy/disabled state |
| AppCard | children, tinted, style | Individual items or genuinely framed tools; not page sections or nested cards |
| AppInput | label, value, onChangeText, error, hint, unit, icon | Reuses FormInput's native keyboard accessory and input behavior; optional search variant |
| AppHeader | title, subtitle, leading, trailing | Wrapping screen heading; native Back/Home headers stay intact |
| FoodListItem | food, onPress, selecting, image, disabled | Keeps serving/source labels and unverified-sample warnings; optional actual image, otherwise a neutral utensil icon |
| CalorieProgressRing | progress, value, caption, accessibilityLabel, overTarget | Presentation only; receives existing domain results, never calculates calorie needs |
| DateNavigator | value, onChange, disabled | Reuses the existing native date picker and local-calendar arithmetic |
| SegmentedControl | label, value, options, onChange, disabled, role | Tab or radio semantics with explicit selected state |

Example:

```tsx
<AppButton title="Add custom food" icon={Plus} onPress={openEditor} />
<AppInput label="Serving amount" value={amount} onChangeText={setAmount}
  keyboardType="decimal-pad" unit="g" error={amountError} />
```

`CalorieProgressRing` clamps its drawn fraction to 0-100% only. Callers still
display the actual consumed and over-target amounts from the repository/domain
layer. The gauge exposes the full values to assistive technology; its central
text fits within its stable dimensions.

## Incremental Adoption

- Home uses AppHeader, DateNavigator, AppCard and CalorieProgressRing. Its data
  loading, selected date, totals and navigation destinations are unchanged.
- Food catalog uses AppInput, AppButton and FoodListItem. Offline search,
  pagination, selection and custom-food navigation are unchanged.
- History uses SegmentedControl in its existing period/view controls.
- Existing FoodField delegates to AppInput, preserving numeric keyboards,
  validation, character limits, notes, disabled state and Step 10's Done action.
- Legacy `foodStyles` use shared typography, colors and control radii. Screens
  with private styling have not all been rewritten; migrate them incrementally
  in future screen-specific work rather than introducing parallel tokens.

The storyboard's sign-in screen, onboarding steps, bottom tabs, favorites and
food photos are not new features in this step. No photos or food values are
invented from the storyboard.

## Validation

```sh
npm run typecheck
npm run lint
npm test
```

`tests/designSystem.test.mjs` checks all eight components, color contrast,
accessibility state, callbacks, labels and presentation geometry. Its lightweight
host mocks use existing React/TypeScript dependencies; they do not emulate native
layout, VoiceOver or physical taps. Existing repository and calculation tests
remain the regression checks for stored data and behavior.

Step 11 results: TypeScript and lint passed; all 74 current tests passed, including
eight design-system tests. The iOS simulator rendered the catalog and a temporary
UI-only preview of the ring, card, input and buttons at standard and large
accessibility text sizes. The preview route was removed after inspection; no
profile or nutrition records were inserted. Native taps and physical-iPhone
VoiceOver/keyboard checks remain manual validation tasks.
