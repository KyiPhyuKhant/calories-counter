import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { flattenStyle, renderModule } from './helpers/renderUI.mjs';
import { createProfileForm } from '../src/navigation/profileSetup.ts';
import { localCalendarDate } from '../src/domain/diary.ts';
import { summarizeDashboard } from '../src/domain/dashboard.ts';
import { theme } from '../src/theme/theme.ts';

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
  assert.deepEqual(tabs.map(({ props }) => props.options.title), ['ပင်မ', 'မှတ်တမ်း', 'အစားအစာ', 'အစီအစဉ်', 'Profile']);
  assert.equal(tabs.find(({ props }) => props.name === '(profile)').props.options.href, '/profile');
  assert.equal(tabs.find(({ props }) => props.name === 'plans').props.options.tabBarActiveTintColor, theme.colors.mealPlan);
  assert.ok(existsSync('src/app/(tabs)/(profile)/profile.tsx'));
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
      '@/screens/FoodEditorScreen': { FoodEditorScreen: host('Editor') },
    });
    const catalog = elements.find(({ type }) => type === 'Catalog').props;
    catalog.onAddCustom(); catalog.onSelect({ id: 'food-1' });
    assert.deepEqual(calls, [
      { pathname: `/${owner}/custom-food`, params: { date, meal } },
      { pathname: `/${owner}/edit`, params: { date, meal, foodId: 'food-1' } },
    ]);
    render(`src/app/(tabs)/${owner}/custom-food.tsx`, 'default', {}, {
      'expo-router': routeMocks, '@/screens/FoodEditorScreen': { FoodEditorScreen: host('Editor') },
      '@/screens/FoodCatalogScreen': { FoodCatalogScreen: host('Catalog') },
    });
    elements.find(({ type }) => type === 'Editor').props.onCreated('new-food');
    assert.deepEqual(calls.at(-1), { pathname: `/${owner}/edit`, params: { foodId: 'new-food', date, meal } });
  }
});

test('all food-entry routes preserve date validation and the default snacks meal', () => {
  for (const owner of ['diary', 'plans']) {
    for (const action of ['select', 'custom-food']) {
      const path = `src/app/(tabs)/${owner}/${action}.tsx`;
      const calls = [];
      const mocks = {
        'expo-router': { ...routerMock, useLocalSearchParams: () => ({ date: '2026-02-30' }),
          useRouter: () => ({ replace: (href) => calls.push(href) }) },
        '@/screens/FoodCatalogScreen': { FoodCatalogScreen: host('Catalog') },
        '@/screens/FoodEditorScreen': { FoodEditorScreen: host('Editor') },
      };
      assert.match(render(path, 'default', {}, mocks).markup, /ရက်စွဲ မမှန်ပါ။/);
      assert.equal(elements.some(({ type }) => type === 'Catalog' || type === 'Editor'), false);
      mocks['expo-router'].useLocalSearchParams = () => ({ date: '2026-10-18', meal: 'invalid' });
      render(path, 'default', {}, mocks);
      if (action === 'select') elements.find(({ type }) => type === 'Catalog').props.onSelect({ id: 'food' });
      else elements.find(({ type }) => type === 'Editor').props.onCreated('food');
      assert.deepEqual(calls, [{ pathname: `/${owner}/edit`, params: { foodId: 'food', date: '2026-10-18', meal: 'snacks' } }]);
    }
  }
});

test('Home keeps calorie progress and meal summaries without the redundant shortcut section', () => {
  const day = summarizeDashboard(profile, [{ meal: 'breakfast', total_calories: 300 }]);
  const { markup, nodes } = render('src/screens/DashboardScreen.tsx', 'DashboardScreen', {}, {
    react: { ...React, useState: (initial) => React.useState(initial === null ? { date: localCalendarDate(), day } : initial) },
    'expo-router': { ...routerMock, useFocusEffect() {} },
    '@/data/DatabaseProvider': { useRepositories: () => ({}) },
  });
  assert.match(markup, /300 kcal/);
  assert.match(markup, /စားသုံးပြီးသော အစားအစာများ/);
  assert.ok(nodes.some(({ props }) => props.accessibilityRole === 'progressbar'));
  const logo = nodes.find(({ type, props }) => type === 'Image' && props.accessibilityLabel === 'CalNote logo');
  assert.ok(logo); assert.equal(flattenStyle(logo.props.style).width, 88);
  for (const label of ['ကြိုတင်စီစဉ်ရန်', 'အစားအစာစာရင်း', 'Weight and calorie history', 'ကိုယ်ရေးအချက်အလက်']) {
    assert.ok(!nodes.some(({ type, props }) => type === 'Text' && props.children === label));
  }
});

test('the welcome screen displays the supplied local logo and preserves the setup action', () => {
  const { nodes } = onboarding('welcome', createProfileForm(profile));
  const logo = nodes.find(({ type, props }) => type === 'Image' && props.accessibilityLabel === 'CalNote logo');
  assert.ok(logo); assert.match(logo.props.source.uri, /healthy-bowl-logo\.png$/);
  assert.equal(flattenStyle(logo.props.style).width, 220);
  assert.ok(nodes.some(({ type, props }) => type === 'Text' && props.accessibilityRole === 'header' && props.children === 'CalNote'));
  assert.ok(nodes.some(({ type, props }) => type === 'Pressable' && props.accessibilityLabel === 'Get started'));
});

test('planning uses compact wrapping buttons with readable touch targets and preserves food-selection routes', () => {
  const date = '2026-10-18'; const calls = []; let state = 0;
  const result = { date, target: 2000, entries: [{ id: 'fixture', name: 'Test food', source: 'custom', meal: 'breakfast',
    total_calories: 200, quantity: 1, quantity_mode: 'servings', serving_unit: 'g', eaten_at: null }] };
  const { nodes } = render('src/screens/PlanScreen.tsx', 'PlanScreen', {}, {
    react: { ...React, useState: (initial) => React.useState(state++ === 1 ? result : initial) },
    'expo-router': { ...routerMock, useLocalSearchParams: () => ({ date }), useFocusEffect() {},
      useRouter: () => ({ push: (href) => calls.push(href) }) },
    '@/data/DatabaseProvider': { useRepositories: () => ({}) },
  });
  const addButtons = nodes.filter(({ type, props }) => type === 'Pressable' && props.accessibilityLabel?.endsWith('အတွက် အစားအစာစီစဉ်ရန်'));
  assert.equal(addButtons.length, 4);
  for (const { props } of addButtons) {
    const style = flattenStyle(props.style);
    assert.equal(style.minHeight, 44); assert.equal(style.height, undefined);
    assert.equal(style.backgroundColor, theme.colors.mealPlanSurface);
    assert.equal(style.alignSelf, 'flex-start'); props.onPress();
  }
  assert.deepEqual(calls.map(({ params }) => params), ['breakfast', 'lunch', 'dinner', 'snacks'].map((meal) => ({ date, meal })));
  assert.ok(calls.every(({ pathname }) => pathname === '/plans/select'));
  const labels = nodes.filter(({ type, props }) => type === 'Text' && props.children === 'အစားအစာစီစဉ်ရန်');
  assert.ok(labels.every(({ props }) => flattenStyle(props.style).fontSize === 14));
});

test('Diary matches planning meal cards while keeping consumed totals and diary add/edit destinations', () => {
  const date = '2026-10-18'; const calls = [];
  const entry = { id: 'fixture', name: 'Test food', source: 'custom', meal: 'breakfast', entry_date: date,
    total_calories: 200, quantity: 1, quantity_mode: 'servings', serving_unit: 'g', eaten_at: null };
  function dayScreen(screen) {
    let state = 0;
    return render(`src/screens/${screen}.tsx`, screen, {}, {
      react: { ...React, useState: (initial) => {
        const index = state++;
        return React.useState(index === 1 ? { date, entries: [entry], target: 2000 } : screen === 'DiaryScreen' && index === 2 ? false : initial);
      } },
      'expo-router': { ...routerMock, useLocalSearchParams: () => ({ date }), useFocusEffect() {},
        useRouter: () => ({ push: (href) => calls.push(href) }) },
      '@/data/DatabaseProvider': { useRepositories: () => ({ diary: {} }) },
    });
  }
  const plans = dayScreen('PlanScreen');
  const diary = dayScreen('DiaryScreen');
  const cards = (nodes) => nodes.filter(({ type, props }) => type === 'View' && flattenStyle(props.style).borderLeftWidth === 3);
  assert.equal(cards(diary.nodes).length, 4);
  assert.deepEqual(cards(diary.nodes).map(({ props }) => flattenStyle(props.style)), cards(plans.nodes).map(({ props }) => flattenStyle(props.style)));
  assert.match(diary.markup, /စားသုံးပြီး/); assert.match(diary.markup, /200 kcal/);
  assert.doesNotMatch(diary.markup, /စီစဉ်ထားသော ကယ်လိုရီ/);
  assert.equal((diary.markup.match(/မှတ်တမ်းမရှိသေးပါ/g) ?? []).length, 3);
  const add = diary.nodes.filter(({ type, props }) => type === 'Pressable' && props.accessibilityLabel?.endsWith('တွင် အစားအစာထည့်ရန်'));
  assert.equal(add.length, 4);
  add.forEach(({ props }) => { assert.equal(flattenStyle(props.style).minHeight, 44); props.onPress(); });
  assert.deepEqual(calls, ['breakfast', 'lunch', 'dinner', 'snacks'].map((meal) => ({ pathname: '/diary/select', params: { date, meal } })));
  diary.nodes.find(({ type, props }) => type === 'Pressable' && props.accessibilityLabel === 'Test foodကို ပြင်ရန်').props.onPress();
  assert.deepEqual(calls.at(-1), { pathname: '/diary/edit', params: { id: entry.id, date, meal: 'breakfast' } });
});

test('Profile exposes settings and one combined history button without account actions', () => {
  const calls = [];
  const { nodes, markup } = render('src/screens/ProfileOverviewScreen.tsx', 'ProfileOverviewScreen', {}, {
    'expo-router': { ...routerMock, useRouter: () => ({ push: (href) => calls.push(href) }) },
    '@/navigation/LocalProfileProvider': { useLocalProfile: () => ({ profile }) },
  });
  const actions = nodes.filter(({ type }) => type === 'Pressable');
  actions.forEach(({ props }) => props.onPress());
  assert.deepEqual(calls, ['/edit-profile', '/goal-settings', '/history', '/settings']);
  assert.equal(actions.filter(({ props }) => props.accessibilityLabel === 'Weight and calorie history').length, 1);
  assert.doesNotMatch(markup, />Weight history<|>Calorie history</);
  assert.doesNotMatch(markup, /sign in|sign up|log in|account settings/i);
});

test('Calorie History opens its own initial graph view', () => {
  render('src/app/(tabs)/(profile)/history/calories.tsx', 'default', {}, {
    '@/screens/HistoryScreen': { HistoryScreen: host('History') },
  });
  assert.equal(elements.find(({ type }) => type === 'History').props.initialView, 'calories');
});
