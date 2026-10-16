import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { readFileSync } from 'node:fs';
import { theme, uiStyles } from '../src/theme/theme.ts';
import { progressRingMetrics } from '../src/components/ui/progressRing.ts';
import { renderModule, renderUI, flattenStyle } from './helpers/renderUI.mjs';

function contrast(first, second) {
  function luminance(hex) {
    const channels = hex.slice(1).match(/../g).map((channel) => parseInt(channel, 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('shared food sheets retain their native presentation, safe areas, heading, content and dismissal', () => {
  let closed = 0;
  const props = { visible: true, title: 'ယူနစ်', onClose: () => closed++, children: 'sheet content' };
  const { nodes, markup } = renderModule('src/components/foodUi.tsx', 'FoodSheet', props);
  const modal = nodes.find(({ type }) => type === 'Modal').props;
  assert.equal(modal.presentationStyle, 'pageSheet'); assert.equal(modal.animationType, 'slide');
  modal.onRequestClose(); assert.equal(closed, 1);
  assert.ok(nodes.some(({ type }) => type === 'SafeAreaView'));
  assert.ok(nodes.some(({ type }) => type === 'ScrollView'));
  assert.ok(nodes.some(({ type, props }) => type === 'Text' && props.accessibilityRole === 'header' && props.children === 'ယူနစ်'));
  assert.match(markup, /sheet content/);
  const hidden = renderModule('src/components/foodUi.tsx', 'FoodSheet', { ...props, visible: false });
  assert.doesNotMatch(hidden.markup, /sheet content|ယူနစ်/);
});

test('typography uses readable fixed sizes and natural line metrics without constraining control heights', () => {
  assert.equal(theme.typography.title.fontSize, 24);
  assert.equal(theme.typography.body.fontSize, 16);
  for (const text of Object.values(theme.typography)) assert.equal(text.lineHeight, undefined);
  const header = renderUI('AppHeader', { title: 'အစားအစာစာရင်း', subtitle: 'ကယ်လိုရီ' });
  for (const node of header.nodes.filter(({ type }) => type === 'Text')) assert.equal(flattenStyle(node.props.style).lineHeight, undefined);
  const input = renderUI('AppInput', { label: 'အစားအစာအမည်', value: 'မုန့်ဟင်းခါး' });
  const control = input.nodes.find(({ type, props }) => type === 'View' && flattenStyle(props.style).borderWidth === 1);
  const style = flattenStyle(control.props.style);
  assert.equal(style.minHeight, 48); assert.equal(style.height, undefined);
  assert.equal(style.paddingHorizontal, 12); assert.equal(style.paddingVertical, 8);
});

test('supplied brand tokens apply consistently and text/button color pairs preserve accessible contrast', () => {
  assert.equal(theme.colors.background, '#FAFAF7'); assert.equal(theme.colors.primary, '#21865A');
  assert.equal(theme.colors.primaryDark, '#075A43'); assert.equal(theme.colors.primaryLight, '#A7D68E');
  assert.equal(theme.colors.text, '#17233B'); assert.equal(theme.colors.border, '#E2E8E5');
  assert.equal(theme.colors.accent, theme.colors.primaryDark);
  assert.equal(theme.colors.accentSurface, theme.colors.primaryLight);
  assert.equal(theme.colors.mealPlan, theme.colors.primaryDark); assert.equal(theme.colors.planning, theme.colors.primary);
  assert.equal(theme.radius.card, 16);
  assert.ok(contrast(theme.colors.onPrimary, theme.colors.primary) >= 4.5);
  assert.ok(contrast(theme.colors.accent, theme.colors.background) >= 4.5);
  assert.ok(contrast(theme.colors.secondaryText, theme.colors.background) >= 4.5);
  assert.ok(contrast(theme.colors.surface, theme.colors.danger) >= 4.5);
  assert.ok(contrast(theme.colors.onMealPlan, theme.colors.mealPlan) >= 4.5);
  assert.ok(contrast(theme.colors.mealPlan, theme.colors.mealPlanSurface) >= 4.5);
});

test('the supplied square logo is bundled locally, configured as the icon and rendered without cropping', () => {
  const config = JSON.parse(readFileSync('app.json', 'utf8')).expo;
  assert.equal(config.name, 'CalNote');
  assert.equal(config.icon, './assets/healthy-bowl-logo.png');
  assert.equal(config.backgroundColor, theme.colors.background);
  const png = readFileSync(config.icon);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), png.readUInt32BE(20)); assert.ok(png.readUInt32BE(16) >= 1024);
  for (const size of [48, 88, 220]) {
    const { nodes } = renderModule('src/components/BrandLogo.tsx', 'BrandLogo', { size });
    const logo = nodes.find(({ type }) => type === 'Image').props;
    assert.equal(logo.resizeMode, 'contain'); assert.equal(logo.accessibilityLabel, 'CalNote logo');
    assert.equal(flattenStyle(logo.style).width, size); assert.equal(flattenStyle(logo.style).aspectRatio, 1);
    assert.equal(flattenStyle(logo.style).height, size);
    assert.match(logo.source.uri, /assets\/healthy-bowl-logo\.png$/);
  }
});

test('forms and pickers share the same input tokens and Profile uses the shared primary button style', () => {
  const input = renderUI('AppInput', { label: 'Name', value: 'Test' });
  const control = input.nodes.find(({ type, props }) => type === 'View' && flattenStyle(props.style).borderWidth === 1);
  const unit = renderModule('src/components/foodUi.tsx', 'ServingUnitPicker', { value: 'g', onChange() {}, disabled: false });
  const cuisine = renderModule('src/components/CuisinePicker.tsx', 'CuisinePicker', { value: null, onChange() {} });
  for (const style of [control.props.style, unit.nodes.find(({ type }) => type === 'Pressable').props.style, cuisine.nodes.find(({ type }) => type === 'Pressable').props.style]) {
    const actual = flattenStyle(style);
    for (const [key, value] of Object.entries(uiStyles.input)) assert.equal(actual[key], value);
  }
  const profile = renderModule('src/screens/ProfileScreen.tsx', 'ProfileScreen', {}, {
    react: { ...React, useState: (initial) => React.useState(initial === true ? false : initial) },
    '@/data/DatabaseProvider': { useRepositories: () => ({ profiles: {} }) },
  });
  assert.match(profile.markup, /Save profile/);
  const save = profile.nodes.find(({ type, props }) => type === 'Pressable' && flattenStyle(props.style).backgroundColor === theme.colors.primary);
  assert.ok(save);
  for (const [key, value] of Object.entries(uiStyles.button)) assert.equal(flattenStyle(save.props.style)[key], value);
  assert.ok(contrast(theme.colors.onDanger, theme.colors.danger) >= 4.5);
});

test('buttons expose disabled/loading states and preserve action callbacks', () => {
  let presses = 0;
  let result = renderUI('AppButton', { title: 'Save food', onPress: () => presses++ });
  let button = result.nodes.find((node) => node.type === 'Pressable').props;
  assert.equal(button.accessibilityRole, 'button'); assert.equal(button.accessibilityLabel, 'Save food');
  button.onPress(); assert.equal(presses, 1);
  assert.ok(flattenStyle(button.style({ pressed: false })).minHeight >= 44);
  for (const props of [{ loading: true }, { disabled: true }]) {
    result = renderUI('AppButton', { title: 'Save food', ...props });
    button = result.nodes.find((node) => node.type === 'Pressable').props;
    assert.equal(button.disabled, true); assert.equal(button.accessibilityState.disabled, true);
    assert.equal(button.accessibilityState.busy, Boolean(props.loading));
  }
});

test('inputs retain the keyboard accessory, native input props and announced errors', () => {
  const result = renderUI('AppInput', { label: 'Weight (kg)', value: '79,25', keyboardType: 'decimal-pad', error: 'Check weight', editable: false });
  const input = result.nodes.find((node) => node.type === 'TextInput').props;
  assert.equal(input.value, '79,25'); assert.equal(input.keyboardType, 'decimal-pad');
  assert.equal(input.accessibilityLabel, 'Weight (kg)'); assert.equal(input.accessibilityHint, 'Check weight');
  assert.equal(input.accessibilityState.disabled, true); assert.ok(input.inputAccessoryViewID);
  assert.ok(result.nodes.some((node) => node.props.accessibilityRole === 'alert'));
  assert.ok(result.nodes.some((node) => node.props.accessibilityLabel === 'ကီးဘုတ်ပိတ်ရန်'));
});

test('headers keep a readable heading and cards share radius and shadow tokens', () => {
  const header = renderUI('AppHeader', { title: 'Food library', subtitle: 'Saved foods' });
  assert.ok(header.nodes.some((node) => node.props.accessibilityRole === 'header'));
  assert.ok(header.markup.includes('Saved foods'));
  const card = renderUI('AppCard', { tinted: true });
  const style = flattenStyle(card.nodes[0].props.style);
  assert.equal(style.borderRadius, 16); assert.equal(style.backgroundColor, theme.colors.accentSurface);
  assert.ok(style.shadowOpacity > 0 && style.shadowOpacity < 0.1);
});

test('segments preserve selected/checked state and dispatch the selected option', () => {
  let value;
  const options = [{ value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }];
  const result = renderUI('SegmentedControl', { label: 'Period', value: 'week', options, role: 'radio', onChange: (selected) => { value = selected; } });
  const buttons = result.nodes.filter((node) => node.type === 'Pressable');
  assert.equal(buttons[0].props.accessibilityState.checked, true);
  assert.equal(buttons[1].props.accessibilityState.checked, false);
  buttons[1].props.onPress(); assert.equal(value, 'month');
  const disabled = renderUI('SegmentedControl', { label: 'Period', value: 'week', options, disabled: true });
  assert.ok(disabled.nodes.filter((node) => node.type === 'Pressable').every((node) => node.props.disabled));
  const unselected = renderUI('SegmentedControl', { label: 'Period', value: '', options, role: 'radio', onChange() {} });
  assert.ok(unselected.nodes.filter(({ type }) => type === 'Pressable').every(({ props }) => props.accessibilityState.checked === false));
});

test('food rows retain serving and unverified source labels and select/view semantics', () => {
  const food = { name: 'Test sample', source: 'bundled', calories: 80, serving_amount: 1, serving_unit: 'piece' };
  for (const selecting of [true, false]) {
    let pressed = false;
    const result = renderUI('FoodListItem', { food, selecting, onPress: () => { pressed = true; } });
    const row = result.nodes.find((node) => node.type === 'Pressable').props;
    assert.equal(row.accessibilityHint, selecting ? 'ဤအစားအစာကို ရွေးရန်' : 'အချက်အလက် ကြည့်ရန်');
    assert.ok(row.accessibilityLabel.includes('အတည်မပြုထားသော')); assert.ok(result.markup.includes('80 kcal / 1 ခု'));
    row.onPress(); assert.equal(pressed, true);
  }
});

test('date navigation reuses local calendar arithmetic and disables range boundaries', () => {
  let selected;
  const result = renderUI('DateNavigator', { value: '2024-02-29', onChange: (value) => { selected = value; } });
  result.nodes.find((node) => node.props.accessibilityLabel === 'နောက်နေ့').props.onPress();
  assert.equal(selected, '2024-03-01');
  for (const [value, label] of [['1900-01-01', 'ယခင်နေ့'], ['2100-12-31', 'နောက်နေ့']]) {
    const boundary = renderUI('DateNavigator', { value, onChange() {} });
    assert.equal(boundary.nodes.find((node) => node.props.accessibilityLabel === label).props.disabled, true);
  }
});

test('ring geometry clamps presentation only and keeps the full calorie value accessible', () => {
  for (const [value, expected] of [[0, 0], [0.5, 0.5], [1, 1], [1.5, 1], [-1, 0], [NaN, 0]]) {
    const metrics = progressRingMetrics(value);
    assert.equal(metrics.fraction, expected); assert.ok(Number.isFinite(metrics.offset));
    assert.ok(metrics.offset >= 0 && metrics.offset <= metrics.circumference);
  }
  const result = renderUI('CalorieProgressRing', { progress: 1.2, value: '2400 kcal', caption: 'of 2000 kcal', accessibilityLabel: '400 kcal over target', overTarget: true });
  const ring = result.nodes.find((node) => node.props.accessibilityRole === 'progressbar').props;
  assert.equal(ring.accessibilityValue.now, 100); assert.ok(ring.accessibilityValue.text.includes('2400 kcal'));
  assert.equal(ring.accessibilityLabel, '400 kcal over target');
});
