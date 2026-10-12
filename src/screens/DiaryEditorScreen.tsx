import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { caloriesLabel, DiaryDateField, DiaryMealField, diaryStyles } from '@/components/diaryUi';
import { FoodField, foodStyles as styles } from '@/components/foodUi';
import { useRepositories } from '@/data/DatabaseProvider';
import { calculateDiaryNutrition, localCalendarDate, meals, validateCalendarDate, type DiaryEntry, type DiaryInput, type Meal, type QuantityMode } from '@/domain/diary';
import type { Food } from '@/domain/food';
import { theme } from '@/theme/theme';

function scalar(value?: string | string[]) { return Array.isArray(value) ? value[0] : value; }

export function DiaryEditorScreen() {
  const params = useLocalSearchParams<{ id?: string; foodId?: string; date?: string; meal?: string }>();
  const id = scalar(params.id);
  const foodId = scalar(params.foodId);
  const { diary, foods } = useRepositories();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Food | DiaryEntry | null>(null);
  const [date, setDate] = useState(() => scalar(params.date) ?? localCalendarDate());
  const [meal, setMeal] = useState<Meal>(() => meals.includes(scalar(params.meal) as Meal) ? scalar(params.meal) as Meal : 'snacks');
  const [quantity, setQuantity] = useState('1');
  const [mode, setMode] = useState<QuantityMode>('servings');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      validateCalendarDate(scalar(params.date) ?? localCalendarDate());
      const result = id ? await diary.get(id) : foodId ? await foods.get(foodId) : null;
      if (!result) throw new Error(id ? 'Diary entry not found.' : 'Select a food from the catalog.');
      if (!active) return;
      setSnapshot(result);
      if ('entry_date' in result) { setDate(result.entry_date); setMeal(result.meal); setQuantity(result.quantity.toString()); setMode(result.quantity_mode); }
      setLoading(false);
    }
    load().catch((failure) => { if (active) { setLoadError(failure instanceof Error ? failure.message : 'Could not load this entry.'); setLoading(false); } });
    return () => { active = false; };
  }, [diary, foods, id, foodId, params.date, attempt]);

  const input: DiaryInput = { date, meal, quantity: /^\d+(\.\d+)?$/.test(quantity.trim()) ? Number(quantity) : NaN, quantity_mode: mode };
  let preview: ReturnType<typeof calculateDiaryNutrition> | null = null;
  let validation = '';
  if (snapshot) {
    try { preview = calculateDiaryNutrition(snapshot, input); }
    catch (failure) { validation = failure instanceof Error ? failure.message : 'Check your quantity.'; }
  }
  async function save() {
    if (!preview || !snapshot) { setError(validation || 'Select a food first.'); return; }
    setSaving(true); setError('');
    try {
      if (id) await diary.update(id, input);
      else await diary.addEntry(snapshot.id, input);
      router.dismissTo({ pathname: '/diary', params: { date } });
    } catch { setError('Could not save this entry. Your edits are still here; please try again.'); }
    finally { setSaving(false); }
  }
  if (loading) return <View style={styles.status}><ActivityIndicator accessibilityLabel="Loading entry" color={theme.colors.accent} /></View>;
  if (loadError || !snapshot) return <View style={styles.status}><Text accessibilityRole="alert" style={styles.error}>{loadError}</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => { setLoadError(''); setLoading(true); setAttempt((value) => value + 1); }}><Text style={styles.buttonText}>Try again</Text></Pressable></View>;

  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.screen}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>{snapshot.name}</Text>
        <Text style={styles.body}>{caloriesLabel(snapshot.calories)} per {snapshot.serving_amount} {snapshot.serving_unit}</Text>
        {snapshot.source === 'bundled' ? <Text style={styles.error}>Invented development values, not verified nutritional data.</Text> : null}
        {id ? <Text style={styles.detail}>Nutrition saved when this food was logged.</Text> : null}
        <View style={styles.field}><Text style={styles.label}>Date</Text><DiaryDateField value={date} onChange={setDate} disabled={saving} /></View>
        <DiaryMealField value={meal} onChange={setMeal} disabled={saving} />
        <View style={diaryStyles.controls}>
          {(['servings', 'amount'] as const).map((choice) => <Pressable key={choice} accessibilityRole="radio" accessibilityState={{ checked: mode === choice, disabled: saving }}
            disabled={saving} style={[styles.option, diaryStyles.control, mode === choice ? styles.selected : undefined]}
            onPress={() => {
              if (choice === mode) return;
              setQuantity(preview ? String(choice === 'amount' ? preview.amount : preview.amount / snapshot.serving_amount) : '1');
              setMode(choice); setError('');
            }}>
            <Text style={styles.body}>{choice === 'servings' ? 'Servings' : `Amount (${snapshot.serving_unit})`}</Text></Pressable>)}
        </View>
        <FoodField label={mode === 'servings' ? 'Number of servings' : `Quantity (${snapshot.serving_unit})`} value={quantity} numeric disabled={saving}
          onChange={(value) => { setQuantity(value); setError(''); }} error={validation} />
        {preview ? <View style={styles.field}>
          <Text style={styles.nutrition}>{caloriesLabel(preview.calories)}</Text>
          <Text style={styles.detail}>{Number(preview.amount.toFixed(3))} {snapshot.serving_unit}</Text>
        </View> : null}
        <Pressable accessibilityRole="button" disabled={saving} style={[styles.button, saving ? styles.disabled : undefined]} onPress={save}>
          <Text style={styles.buttonText}>{saving ? 'Saving...' : id ? 'Save changes' : 'Log food'}</Text></Pressable>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
