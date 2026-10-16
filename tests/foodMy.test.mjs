import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import ts from 'typescript';
import { cuisineLabels, validateFood } from '../src/domain/food.ts';
import { parseFormNumber } from '../src/domain/formNumber.ts';
import { displayFoodName, foodAmount, foodDateLabel, foodErrorMessage, foodFormUnits, foodText, foodValidationErrors, unitLabels } from '../src/i18n/foodMy.ts';
import { createSimpleFoodForm, simpleFoodInput } from '../src/screens/simpleFoodForm.ts';
import { initializeDatabase } from '../src/data/migrations.ts';
import { createRepositories } from '../src/data/repositories.ts';
import { seedBundledFoodCatalog } from '../src/data/bundledFoodCatalog.ts';
import { adapt } from './sqlite.mjs';
import { flattenStyle, renderModule, renderUI } from './helpers/renderUI.mjs';

const original = {
  id: 'custom', name: 'Mohinga', native_name: 'မုန့်ဟင်းခါး', aliases: ['Fish noodle soup'], cuisine: 'myanmar',
  calories: 200, serving_amount: 100, serving_unit: 'g', protein: 8, carbohydrates: 30, fat: 4,
  notes: 'Retained original notes', nutrition_source: 'Original source', nutrition_status: 'recipe', category: 'dish', image: 'mohinga.png',
};

test('food form exposes exactly the requested five fields in Myanmar and retains disabled/input callbacks', () => {
  const form = createSimpleFoodForm(original); const changes = [];
  assert.deepEqual(Object.keys(form), ['name', 'cuisine', 'calories', 'serving_amount', 'serving_unit']);
  const result = renderModule('src/components/SimpleFoodFields.tsx', 'SimpleFoodFields', { form, onChange: (value) => changes.push(value) });
  const inputs = result.nodes.filter(({ type }) => type === 'TextInput');
  assert.deepEqual(inputs.map(({ props }) => props.accessibilityLabel), ['အစားအစာအမည်', 'ကယ်လိုရီ (kcal)', 'အစားအစာပမာဏ']);
  for (const label of [foodText.name, foodText.cuisine, foodText.calories, foodText.amount, foodText.unit]) assert.ok(result.markup.includes(label));
  assert.doesNotMatch(result.markup, /Protein|Carbohydrates|Fat|Notes|Alternative|Nutrition|Native name|ရင်းမြစ်|ပရိုတင်း|ကာဘိုဟိုက်ဒရိတ်|မှတ်ချက်/);
  inputs[0].props.onChangeText('မုန့်ဟင်းခါးအသစ်'); inputs[1].props.onChangeText('၃၀၀');
  assert.deepEqual(changes, [{ name: 'မုန့်ဟင်းခါးအသစ်' }, { calories: '၃၀၀' }]);
  const blocked = renderModule('src/components/SimpleFoodFields.tsx', 'SimpleFoodFields', { form, onChange() {}, disabled: true });
  assert.ok(blocked.nodes.filter(({ type }) => type === 'TextInput').every(({ props }) => props.editable === false));
});

test('Myanmar inputs and buttons use natural line metrics and flexible heights for Dynamic Type', () => {
  const field = renderUI('AppInput', { label: foodText.name, value: original.native_name });
  const input = field.nodes.find(({ type }) => type === 'TextInput').props;
  assert.equal(flattenStyle(input.style).lineHeight, undefined);
  const label = field.nodes.find(({ type, props }) => type === 'Text' && props.children === foodText.name).props;
  assert.equal(flattenStyle(label.style).lineHeight, undefined);
  const button = renderUI('AppButton', { title: foodText.save });
  const text = button.nodes.find(({ type }) => type === 'Text').props;
  assert.equal(flattenStyle(text.style).lineHeight, undefined);
  const pressable = button.nodes.find(({ type }) => type === 'Pressable').props;
  assert.equal(flattenStyle(pressable.style({ pressed: false })).height, undefined);
});

test('unchanged simplified edits preserve English names and every hidden nutrition/metadata field', () => {
  const form = createSimpleFoodForm(original); assert.equal(form.name, original.native_name);
  const input = simpleFoodInput(form, original);
  for (const key of ['name', 'native_name', 'aliases', 'protein', 'carbohydrates', 'fat', 'notes', 'nutrition_source', 'nutrition_status', 'category', 'image', 'calories', 'serving_amount', 'serving_unit', 'cuisine']) assert.deepEqual(input[key], original[key]);
  assert.deepEqual(validateFood(input), {});
});

test('Myanmar display-name edits retain the searchable English name and hidden aliases', () => {
  const input = simpleFoodInput({ ...createSimpleFoodForm(original), name: 'အိမ်ချက်မုန့်ဟင်းခါး' }, original);
  assert.equal(input.name, 'Mohinga'); assert.equal(input.native_name, 'အိမ်ချက်မုန့်ဟင်းခါး');
  assert.ok(input.aliases.includes('Fish noodle soup')); assert.ok(input.aliases.includes(original.native_name));
  const full = { ...original, aliases: Array.from({ length: 32 }, (_, index) => `Alias ${index}`) };
  const fullEdit = simpleFoodInput({ ...createSimpleFoodForm(full), name: 'အိမ်ချက်မုန့်ဟင်းခါး' }, full);
  assert.deepEqual(fullEdit.aliases, full.aliases); assert.deepEqual(validateFood(fullEdit), {});
});

test('explicit English renames retain previous Myanmar and English names as search aliases', () => {
  const input = simpleFoodInput({ ...createSimpleFoodForm(original), name: 'My noodle soup' }, original);
  assert.equal(input.name, 'My noodle soup'); assert.equal(input.native_name, null);
  assert.ok(input.aliases.includes('Mohinga')); assert.ok(input.aliases.includes(original.native_name));
  assert.equal(displayFoodName(input), 'My noodle soup');
});

test('four visible unit choices do not silently convert or overwrite existing legacy units', () => {
  assert.deepEqual(foodFormUnits, ['g', 'ml', 'serving', 'piece']);
  assert.deepEqual(foodFormUnits.map((unit) => unitLabels[unit]), ['ဂရမ် (g)', 'မီလီလီတာ (ml)', 'တစ်ပွဲ', 'တစ်ခု']);
  for (const serving_unit of ['kg', 'oz', 'cup']) {
    const food = { ...original, serving_unit }; const form = createSimpleFoodForm(food);
    assert.equal(form.serving_unit, serving_unit); assert.equal(simpleFoodInput(form, food).serving_unit, serving_unit);
    assert.equal(simpleFoodInput(form, food).serving_amount, 100);
  }
});

test('unknown calories stay null, zero stays zero, and Myanmar numerals use the same numeric validation', () => {
  assert.equal(simpleFoodInput(createSimpleFoodForm()).calories, null);
  assert.equal(simpleFoodInput({ ...createSimpleFoodForm(), calories: '၀' }).calories, 0);
  assert.equal(simpleFoodInput({ ...createSimpleFoodForm(), calories: '၂၅၀.၅', serving_amount: '၁၀၀' }).calories, 250.5);
  assert.equal(parseFormNumber(' ၁၂,၅ '), 12.5); assert.ok(Number.isNaN(parseFormNumber('၁,၀၀၀,၀၀၀')));
  const errors = foodValidationErrors(validateFood({ ...simpleFoodInput(createSimpleFoodForm()), calories: -1, serving_amount: 0 }));
  assert.match(errors.calories, /ကယ်လိုရီ/); assert.match(errors.serving_amount, /ပမာဏ/);
  assert.doesNotMatch(Object.values(errors).join(' '), /[A-Za-z]/);
});

test('Myanmar-only food labels and display names never show a second English/native translation', () => {
  assert.deepEqual(cuisineLabels, { myanmar: 'မြန်မာ', japanese: 'ဂျပန်', western: 'အနောက်တိုင်း', chinese: 'တရုတ်' });
  const row = renderUI('FoodListItem', { food: { ...original, source: 'custom' }, onPress() {} });
  assert.match(row.markup, /မုန့်ဟင်းခါး/); assert.doesNotMatch(row.markup, /Mohinga|Fish noodle soup/);
  assert.equal(displayFoodName({ name: 'Shoyu Ramen', native_name: '醤油ラーメン' }), 'Shoyu Ramen');
  assert.equal(displayFoodName({ name: 'Mohinga' }), 'မုန့်ဟင်းခါး');
  assert.equal(displayFoodName({ name: 'My old diary name' }), 'My old diary name');
  assert.equal(foodAmount(2, 'serving'), '2 ပွဲ');
  assert.equal(foodDateLabel('2026-10-15'), '15 October 2026');
  assert.throws(() => foodDateLabel('2026-02-30'));
});

test('backend failures are localized at the UI boundary without changing validation/business error contracts', () => {
  const duplicate = new Error('A food with this name and serving already exists.'); duplicate.name = 'DuplicateFoodError';
  for (const error of [duplicate, new Error('Calories are unavailable.'), new Error('These units need a food-specific conversion.'), new Error('Choose an empty destination date to avoid duplicate plans.'), new Error('SQLite failure with internal details')]) {
    const text = foodErrorMessage(error, foodText.saveError); assert.doesNotMatch(text, /[A-Za-z]/);
  }
});

test('simplified saves preserve stored metadata, English/Myanmar search, snapshots, and schema version', async (t) => {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close()); const db = adapt(sqlite); await initializeDatabase(db);
  await seedBundledFoodCatalog(db); const r = createRepositories(db, randomUUID);
  const id = await r.foods.createCustom(original); const saved = await r.foods.get(id);
  const entryId = await r.diary.addEntry(id, { date: '2026-10-15', meal: 'lunch', quantity: 1, quantity_mode: 'servings' });
  const snapshot = await r.diary.get(entryId);
  const form = { ...createSimpleFoodForm(saved), calories: '၃၀၀' };
  await r.foods.updateCustom(id, simpleFoodInput(form, saved));
  const edited = await r.foods.get(id);
  assert.equal(edited.calories, 300); assert.equal(edited.nutrition_status, 'user_entered');
  for (const key of ['name', 'native_name', 'aliases', 'protein', 'carbohydrates', 'fat', 'notes', 'nutrition_source', 'category', 'image']) assert.deepEqual(edited[key], saved[key]);
  assert.ok((await r.foods.search('Mohinga')).some((food) => food.id === id));
  assert.ok((await r.foods.search('မုန့်ဟင်းခါး')).some((food) => food.id === id));
  assert.deepEqual(await r.diary.get(entryId), snapshot); assert.equal(snapshot.total_calories, 200);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 8);
  assert.equal((await db.getFirstAsync("SELECT count(*) AS n FROM foods WHERE id LIKE 'catalog:%'")).n, 150);
});

test('food screens and shared controls have no hard-coded English JSX labels', () => {
  const files = ['src/screens/FoodCatalogScreen.tsx', 'src/screens/FoodEditorScreen.tsx', 'src/screens/FoodDetailScreen.tsx', 'src/screens/DiaryEditorScreen.tsx', 'src/screens/DiaryScreen.tsx', 'src/screens/PlanScreen.tsx',
    'src/components/SimpleFoodFields.tsx', 'src/components/CuisinePicker.tsx', 'src/components/foodUi.tsx', 'src/components/diaryUi.tsx', 'src/components/NavigationButton.tsx'];
  for (const file of files) {
    const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxText(node)) assert.doesNotMatch(node.text.trim(), /[A-Za-z]/, `${file}: ${node.text}`);
      if (ts.isJsxAttribute(node) && ['label', 'title', 'placeholder', 'accessibilityLabel', 'accessibilityHint'].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) assert.doesNotMatch(node.initializer.text, /[A-Za-z]/, `${file}: ${node.initializer.text}`);
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
});
