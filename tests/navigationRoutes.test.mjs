import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { renderModule } from './helpers/renderUI.mjs';
import { createProfileForm } from '../src/navigation/profileSetup.ts';

const elements = [];
function host(type) { return (props) => { elements.push({ type, props }); return props.children; }; }
const Stack = Object.assign(host('Stack'), { Screen: host('Screen'), Protected: ({ guard, children }) => guard ? children : null });
const Tabs = Object.assign(host('Tabs'), { Screen: host('Tab') });
const router = { push() {}, replace() {}, navigate() {}, canGoBack: () => true, back() {} };
const routerMock = { Stack, Tabs, useRouter: () => router, useLocalSearchParams: () => ({}), Redirect: host('Redirect') };
function render(path, name = 'default', props = {}, mocks = {}) {
  elements.length = 0;
  return renderModule(path, name, props, { 'expo-router': routerMock, ...mocks });
}

test('the five main tabs are ordered, labeled, anchored at Home and leave safe-area sizing to the navigator', () => {
  render('src/app/(tabs)/_layout.tsx');
  const tabs = elements.filter(({ type }) => type === 'Tab');
  assert.deepEqual(tabs.map(({ props }) => props.name), ['index', 'diary', 'foods', 'plans', '(profile)']);
  assert.deepEqual(tabs.map(({ props }) => props.options.title), ['ပင်မ', 'မှတ်တမ်း', 'အစားအစာ', 'အစီအစဉ်', 'ကိုယ်ရေး']);
  assert.ok(tabs.every(({ props }) => props.options.tabBarAccessibilityLabel));
  const options = elements.find(({ type }) => type === 'Tabs').props;
  assert.equal(options.initialRouteName, 'index');
  assert.equal(options.screenOptions.headerShown, false);
  assert.equal(options.screenOptions.tabBarStyle.height, undefined);
});

test('detail and form screens are nested in their owning tab stacks', () => {
  for (const [directory, expected] of [
    ['diary', ['index', 'select', 'edit', 'custom-food']],
    ['foods', ['index', '[id]', 'edit']],
    ['plans', ['index', 'select', 'edit', 'custom-food']],
    ['(profile)', ['profile', 'edit-profile', 'goal-settings', 'history/index', 'history/calories', 'history/weight', 'settings']],
  ]) {
    render(`src/app/(tabs)/${directory}/_layout.tsx`);
    assert.deepEqual(elements.filter(({ type }) => type === 'Screen').map(({ props }) => props.name), expected);
    for (const route of expected) assert.ok(existsSync(`src/app/(tabs)/${directory}/${route}.tsx`));
    const stack = elements.find(({ type }) => type === 'Stack').props;
    assert.equal(typeof stack.screenOptions.headerLeft, 'function');
    assert.equal(typeof stack.screenOptions.headerRight, 'function');
  }
  const routes = readdirSync('src/app', { recursive: true }).filter((name) => name.endsWith('.tsx'));
  assert.ok(routes.every((name) => name === '_layout.tsx' || name.startsWith('(tabs)/') || name.startsWith('onboarding/')));
});

test('onboarding is a separate stack with no Home skip, and all four steps exist', () => {
  render('src/app/onboarding/_layout.tsx', 'default', {}, {
    '@/navigation/OnboardingProvider': { OnboardingProvider: ({ children }) => children },
  });
  assert.deepEqual(elements.filter(({ type }) => type === 'Screen').map(({ props }) => props.name), ['index', 'profile', 'activity', 'target']);
  const options = elements.find(({ type }) => type === 'Stack').props.screenOptions;
  assert.equal(options.headerBackVisible, true); assert.equal(options.headerLeft, undefined);
  assert.equal(options.headerRight(), null);
});

test('root navigation waits for SQLite profile and exclusively exposes onboarding or the main tabs', () => {
  let state = { status: 'ready', completed: false, reload: async () => {} };
  const mocks = {
    '@/navigation/LocalProfileProvider': { useLocalProfile: () => state },
    '@/data/DatabaseProvider': {}, 'expo-status-bar': {},
  };
  render('src/app/_layout.tsx', 'ProfileNavigator', {}, mocks);
  assert.deepEqual(elements.filter(({ type }) => type === 'Screen').map(({ props }) => props.name), ['onboarding']);
  state = { ...state, completed: true };
  render('src/app/_layout.tsx', 'ProfileNavigator', {}, mocks);
  assert.deepEqual(elements.filter(({ type }) => type === 'Screen').map(({ props }) => props.name), ['(tabs)']);
  state = { ...state, status: 'loading' };
  const loading = render('src/app/_layout.tsx', 'ProfileNavigator', {}, mocks);
  assert.equal(elements.length, 0); assert.ok(loading.nodes.some(({ type }) => type === 'ActivityIndicator'));
  state = { ...state, status: 'error' };
  const error = render('src/app/_layout.tsx', 'ProfileNavigator', {}, mocks);
  assert.equal(elements.length, 0); assert.match(error.markup, /သိမ်းထားသော အချက်အလက်များကို မပြောင်းထားပါ/);
});

const profile = { sex: 'male', age: 30, height_cm: 180, current_weight_kg: 80, target_weight_kg: 75, activity_level: 'moderate', goal: 'lose', manual_calorie_target: null };
function onboarding(step, form, saveCalorieProfile = async () => {}, reload = async () => {}) {
  return render('src/screens/OnboardingScreen.tsx', 'OnboardingScreen', { step }, {
    '@/navigation/OnboardingProvider': { useOnboarding: () => ({ form, setForm() {} }) },
    '@/navigation/LocalProfileProvider': { useLocalProfile: () => ({ reload }) },
    '@/data/DatabaseProvider': { useRepositories: () => ({ profiles: { saveCalorieProfile } }) },
  });
}

test('incomplete onboarding deep links return to the required setup step', () => {
  onboarding('activity', createProfileForm());
  assert.equal(elements.find(({ type }) => type === 'Redirect').props.href, '/onboarding/profile');
  onboarding('target', { ...createProfileForm(profile), useManual: true, manual_calorie_target: '10' });
  assert.equal(elements.find(({ type }) => type === 'Redirect').props.href, '/onboarding/activity');
});

test('the target result does not save until Start tracking, and repeated presses cannot duplicate saves', async () => {
  let resolve; const pending = new Promise((done) => { resolve = done; });
  const calls = [];
  const { nodes, markup } = onboarding('target', createProfileForm(profile), async (input) => { calls.push(input); await pending; }, async () => calls.push('reload'));
  assert.match(markup, /Estimated needs, not measured/); assert.equal(calls.length, 0);
  const start = nodes.find(({ type, props }) => type === 'Pressable' && props.accessibilityLabel === 'Start tracking').props.onPress;
  const first = start(); const second = start();
  assert.deepEqual(calls, [profile]); resolve(); await first; await second;
  assert.deepEqual(calls, [profile, 'reload']);
});

test('failed setup saves never complete navigation and allow retrying the same draft', async () => {
  let attempts = 0; let reloaded = false;
  const { nodes } = onboarding('target', createProfileForm(profile), async () => { attempts++; throw new Error('disk full'); }, async () => { reloaded = true; });
  const start = nodes.find(({ type, props }) => type === 'Pressable' && props.accessibilityLabel === 'Start tracking').props.onPress;
  await start(); await start();
  assert.equal(attempts, 2); assert.equal(reloaded, false);
});

test('food selection and custom-food creation retain the originating tab, date and meal', () => {
  for (const owner of ['diary', 'plans']) {
    const calls = [];
    const date = '2026-10-18'; const meal = 'lunch';
    const routeMocks = { ...routerMock, useLocalSearchParams: () => ({ date, meal }), useRouter: () => ({
      push: (href) => calls.push(href), replace: (href) => calls.push(href),
    }) };
    render(`src/app/(tabs)/${owner}/select.tsx`, 'default', {}, {
      'expo-router': routeMocks, '@/screens/FoodCatalogScreen': { FoodCatalogScreen: host('Catalog') },
    });
    const catalog = elements.find(({ type }) => type === 'Catalog').props;
    catalog.onAddCustom(); catalog.onSelect({ id: 'food-1' });
    assert.deepEqual(calls, [
      { pathname: `/${owner}/custom-food`, params: { date, meal } },
      { pathname: `/${owner}/edit`, params: { date, meal, foodId: 'food-1' } },
    ]);
    render('src/screens/CustomFoodForEntryScreen.tsx', 'CustomFoodForEntryScreen', { planning: owner === 'plans' }, {
      'expo-router': routeMocks, '@/screens/FoodEditorScreen': { FoodEditorScreen: host('Editor') },
    });
    elements.find(({ type }) => type === 'Editor').props.onCreated('new-food');
    assert.deepEqual(calls.at(-1), { pathname: `/${owner}/edit`, params: { foodId: 'new-food', date, meal } });
  }
});

test('Profile exposes all settings and history destinations without account actions', () => {
  const calls = [];
  const { nodes, markup } = render('src/screens/ProfileOverviewScreen.tsx', 'ProfileOverviewScreen', {}, {
    'expo-router': { ...routerMock, useRouter: () => ({ push: (href) => calls.push(href) }) },
    '@/navigation/LocalProfileProvider': { useLocalProfile: () => ({ profile }) },
  });
  const actions = nodes.filter(({ type }) => type === 'Pressable');
  actions.forEach(({ props }) => props.onPress());
  assert.deepEqual(calls, ['/edit-profile', '/goal-settings', '/history', '/history/calories', '/settings']);
  assert.doesNotMatch(markup, /sign in|sign up|log in|account settings/i);
});

test('Calorie History opens its own initial graph view', () => {
  render('src/app/(tabs)/(profile)/history/calories.tsx', 'default', {}, {
    '@/screens/HistoryScreen': { HistoryScreen: host('History') },
  });
  assert.equal(elements.find(({ type }) => type === 'History').props.initialView, 'calories');
});
