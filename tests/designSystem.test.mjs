import assert from 'node:assert/strict';
import test from 'node:test';
import { theme } from '../src/theme/theme.ts';
import { progressRingMetrics } from '../src/components/ui/progressRing.ts';
import { renderUI, flattenStyle } from './helpers/renderUI.mjs';

function contrast(first, second) {
  function luminance(hex) {
    const channels = hex.slice(1).match(/../g).map((channel) => parseInt(channel, 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('reference tokens and text/button color pairs preserve accessible contrast', () => {
  assert.equal(theme.colors.background, '#FFFFFF'); assert.equal(theme.colors.primary, '#2F9E68');
  assert.equal(theme.colors.accentSurface, '#EAF7EF'); assert.equal(theme.colors.text, '#14213D');
  assert.equal(theme.colors.surfaceMuted, '#F5F6F8'); assert.equal(theme.radius.card, 16);
  assert.ok(contrast(theme.colors.onPrimary, theme.colors.primary) >= 4.5);
  assert.ok(contrast(theme.colors.accent, theme.colors.background) >= 4.5);
  assert.ok(contrast(theme.colors.secondaryText, theme.colors.background) >= 4.5);
  assert.ok(contrast(theme.colors.surface, theme.colors.danger) >= 4.5);
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
});

test('food rows retain serving and unverified source labels and select/view semantics', () => {
  const food = { name: 'Test sample', source: 'bundled', calories: 80, serving_amount: 1, serving_unit: 'piece' };
  for (const selecting of [true, false]) {
    let pressed = false;
    const result = renderUI('FoodListItem', { food, selecting, onPress: () => { pressed = true; } });
    const row = result.nodes.find((node) => node.type === 'Pressable').props;
    assert.equal(row.accessibilityHint, selecting ? 'ဤအစားအစာကို ရွေးရန်' : 'အစားအစာအချက်အလက် ကြည့်ရန်');
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
