import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodField, ServingUnitPicker, foodStyles as styles } from '@/components/foodUi';
import { useRepositories } from '@/data/DatabaseProvider';
import { validateFood, type Cuisine, type FoodInput, type ServingUnit } from '@/domain/food';
import { CuisinePicker } from '@/components/CuisinePicker';
import { theme } from '@/theme/theme';
import { parseFormNumber } from '@/domain/formNumber';
import { goBack } from '@/navigation/navigation';

type Form = { name: string; cuisine: Cuisine | null; native_name: string; aliases: string; nutrition_source: string; category: FoodInput['category']; image: string | null; calories: string; serving_amount: string; serving_unit: ServingUnit; protein: string; carbohydrates: string; fat: string; notes: string };
const initial: Form = { name: '', cuisine: null, native_name: '', aliases: '', nutrition_source: '', category: null, image: null, calories: '', serving_amount: '100', serving_unit: 'g', protein: '', carbohydrates: '', fat: '', notes: '' };

export function FoodEditorScreen({ onCreated }: { onCreated?: (id: string) => void } = {}) {
  const { id: param, copyId: copyParam } = useLocalSearchParams<{ id?: string | string[]; copyId?: string | string[] }>();
  const id = Array.isArray(param) ? param[0] : param;
  const copyId = Array.isArray(copyParam) ? copyParam[0] : copyParam;
  const loadId = id ?? copyId;
  const { foods } = useRepositories();
  const router = useRouter();
  const [form, setForm] = useState<Form>(initial);
  const [loading, setLoading] = useState(Boolean(loadId));
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loadId) return;
    let active = true;
    foods.get(loadId).then((food) => {
      if (!active) return;
      if (!food || (id && food.source !== 'custom')) { setLoadError('This food is unavailable.'); setLoading(false); return; }
      setForm({ name: food.name, cuisine: food.cuisine, native_name: food.native_name ?? '', aliases: food.aliases.join(', '), nutrition_source: food.nutrition_source ?? '', category: food.category, image: food.image,
        calories: food.calories?.toString() ?? '', serving_amount: food.serving_amount.toString(),
        serving_unit: food.serving_unit, protein: food.protein?.toString() ?? '', carbohydrates: food.carbohydrates?.toString() ?? '',
        fat: food.fat?.toString() ?? '', notes: food.notes ?? '' });
      setLoading(false);
    }).catch(() => { if (active) { setLoadError('Could not load this food.'); setLoading(false); } });
    return () => { active = false; };
  }, [foods, id, loadId, attempt]);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((previous) => ({ ...previous, [key]: value })); setError('');
  }
  const input: FoodInput = { ...form, native_name: form.native_name || null, aliases: form.aliases.split(/[,;\n]/).map((name) => name.trim()).filter(Boolean),
    nutrition_source: form.nutrition_source || null, nutrition_status: form.calories.trim() ? 'user_entered' : 'unverified',
    calories: form.calories.trim() ? parseFormNumber(form.calories) : null, serving_amount: parseFormNumber(form.serving_amount),
    protein: form.protein.trim() ? parseFormNumber(form.protein) : null,
    carbohydrates: form.carbohydrates.trim() ? parseFormNumber(form.carbohydrates) : null,
    fat: form.fat.trim() ? parseFormNumber(form.fat) : null };
  const errors = validateFood(input);
  async function save() {
    if (savingRef.current) return;
    setSubmitted(true);
    if (Object.keys(errors).length) { setError('Check the highlighted fields.'); return; }
    savingRef.current = true; setSaving(true); setError('');
    try {
      if (id) { await foods.updateCustom(id, input); goBack(router); }
      else {
        const newId = await foods.createCustom(input);
        if (onCreated) onCreated(newId);
        else router.replace({ pathname: '/foods/[id]', params: { id: newId } });
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save this food. Please try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  }

  if (loading) return <View style={styles.status}><ActivityIndicator accessibilityLabel="Loading custom food" color={theme.colors.accent} /></View>;
  if (loadError) return <View style={styles.status}><Text accessibilityRole="alert" style={styles.error}>{loadError}</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => { setLoading(true); setLoadError(''); setAttempt((value) => value + 1); }}><Text style={styles.buttonText}>Try again</Text></Pressable></View>;

  return <SafeAreaView edges={['left', 'right']} style={styles.screen}>
      <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text accessibilityRole="header" style={styles.title}>{id ? 'Edit custom food' : 'New custom food'}</Text>
        <FoodField label="Food name" value={form.name} onChange={(value) => update('name', value)} disabled={saving} error={submitted ? errors.name : undefined} />
        <FoodField label="Native name (optional)" value={form.native_name} onChange={(value) => update('native_name', value)} disabled={saving} error={submitted ? errors.native_name : undefined} />
        <FoodField label="Alternative or romanized names (comma separated)" value={form.aliases} multiline onChange={(value) => update('aliases', value)} disabled={saving} error={submitted ? errors.aliases : undefined} />
        <View style={styles.field}><Text style={styles.label}>Cuisine (optional)</Text>
          <CuisinePicker value={form.cuisine} onChange={(value) => update('cuisine', value)} emptyLabel="Unspecified cuisine" disabled={saving} />
        </View>
        <FoodField label="Calories per declared serving (kcal, optional)" value={form.calories} numeric onChange={(value) => update('calories', value)} disabled={saving} error={submitted ? errors.calories : undefined} />
        {!form.calories.trim() ? <Text style={styles.detail}>Calories unavailable. This food cannot be logged or planned yet.</Text> : null}
        <FoodField label="Nutrition source or measured recipe (optional)" value={form.nutrition_source} multiline onChange={(value) => update('nutrition_source', value)} disabled={saving} error={submitted ? errors.nutrition_source : undefined} />
        <FoodField label="Serving amount" value={form.serving_amount} numeric onChange={(value) => update('serving_amount', value)} disabled={saving} error={submitted ? errors.serving_amount : undefined} />
        <ServingUnitPicker value={form.serving_unit} onChange={(value) => update('serving_unit', value)} disabled={saving} />
        {(['protein', 'carbohydrates', 'fat'] as const).map((key) => <FoodField key={key}
          label={`${key[0].toUpperCase()}${key.slice(1)} per declared serving (g, optional)`} value={form[key]} numeric
          onChange={(value) => update(key, value)} disabled={saving} error={submitted ? errors[key] : undefined} />)}
        <FoodField label="Notes (optional)" value={form.notes} multiline onChange={(value) => update('notes', value)} disabled={saving} error={submitted ? errors.notes : undefined} />
        <Pressable accessibilityRole="button" disabled={saving} style={[styles.button, saving ? styles.disabled : undefined]} onPress={save}>
          <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save food'}</Text></Pressable>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
  </SafeAreaView>;
}
