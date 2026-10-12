import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodField, ServingUnitPicker, foodStyles as styles } from '@/components/foodUi';
import { useRepositories } from '@/data/DatabaseProvider';
import { validateFood, type FoodInput, type ServingUnit } from '@/domain/food';
import { theme } from '@/theme/theme';

type Form = { name: string; calories: string; serving_amount: string; serving_unit: ServingUnit; protein: string; carbohydrates: string; fat: string; notes: string };
const initial: Form = { name: '', calories: '', serving_amount: '100', serving_unit: 'g', protein: '', carbohydrates: '', fat: '', notes: '' };
function numeric(value: string) { return /^\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : NaN; }

export function FoodEditorScreen() {
  const { id: param } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(param) ? param[0] : param;
  const { foods } = useRepositories();
  const router = useRouter();
  const [form, setForm] = useState<Form>(initial);
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let active = true;
    foods.get(id).then((food) => {
      if (!active) return;
      if (!food || food.source !== 'custom') { setLoadError('This custom food is unavailable.'); setLoading(false); return; }
      setForm({ name: food.name, calories: food.calories.toString(), serving_amount: food.serving_amount.toString(),
        serving_unit: food.serving_unit, protein: food.protein?.toString() ?? '', carbohydrates: food.carbohydrates?.toString() ?? '',
        fat: food.fat?.toString() ?? '', notes: food.notes ?? '' });
      setLoading(false);
    }).catch(() => { if (active) { setLoadError('Could not load this food.'); setLoading(false); } });
    return () => { active = false; };
  }, [foods, id, attempt]);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((previous) => ({ ...previous, [key]: value })); setError('');
  }
  const input: FoodInput = { ...form, calories: numeric(form.calories), serving_amount: numeric(form.serving_amount),
    protein: form.protein.trim() ? numeric(form.protein) : null,
    carbohydrates: form.carbohydrates.trim() ? numeric(form.carbohydrates) : null,
    fat: form.fat.trim() ? numeric(form.fat) : null };
  const errors = validateFood(input);
  async function save() {
    setSubmitted(true);
    if (Object.keys(errors).length) { setError('Check the highlighted fields.'); return; }
    setSaving(true); setError('');
    try {
      if (id) { await foods.updateCustom(id, input); router.back(); }
      else {
        const newId = await foods.createCustom(input);
        router.replace({ pathname: '/foods/[id]', params: { id: newId } });
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save this food. Please try again.'); }
    finally { setSaving(false); }
  }

  if (loading) return <View style={styles.status}><ActivityIndicator color={theme.colors.accent} /></View>;
  if (loadError) return <View style={styles.status}><Text accessibilityRole="alert" style={styles.error}>{loadError}</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => { setLoading(true); setLoadError(''); setAttempt((value) => value + 1); }}><Text style={styles.buttonText}>Try again</Text></Pressable></View>;

  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.screen}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text accessibilityRole="header" style={styles.title}>{id ? 'Edit custom food' : 'New custom food'}</Text>
        <FoodField label="Food name" value={form.name} onChange={(value) => update('name', value)} disabled={saving} error={submitted ? errors.name : undefined} />
        <FoodField label="Calories per declared serving (kcal)" value={form.calories} numeric onChange={(value) => update('calories', value)} disabled={saving} error={submitted ? errors.calories : undefined} />
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
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
