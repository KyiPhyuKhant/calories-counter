import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { caloriesLabel, DiaryDateField, DiaryMealField, diaryStyles } from '@/components/diaryUi';
import { FoodField, foodStyles as styles, isDevelopmentFood } from '@/components/foodUi';
import { useRepositories } from '@/data/DatabaseProvider';
import { calculateDiaryNutrition, localCalendarDate, meals, validateCalendarDate, type DiaryEntry, type DiaryInput, type Meal, type QuantityMode } from '@/domain/diary';
import type { Food } from '@/domain/food';
import type { PlannedFood } from '@/data/planRepository';
import { theme } from '@/theme/theme';
import { parseFormNumber } from '@/domain/formNumber';
import { displayFoodName, foodAmount, foodErrorMessage, foodText } from '@/i18n/foodMy';

function scalar(value?: string | string[]) { return Array.isArray(value) ? value[0] : value; }

export function DiaryEditorScreen({ planning = false }: { planning?: boolean }) {
  const params = useLocalSearchParams<{ id?: string; foodId?: string; date?: string; meal?: string }>();
  const id = scalar(params.id);
  const foodId = scalar(params.foodId);
  const { diary, plans, foods } = useRepositories();
  const entries = planning ? plans : diary;
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Food | DiaryEntry | PlannedFood | null>(null);
  const [date, setDate] = useState(() => scalar(params.date) ?? localCalendarDate());
  const [meal, setMeal] = useState<Meal>(() => meals.includes(scalar(params.meal) as Meal) ? scalar(params.meal) as Meal : 'snacks');
  const [quantity, setQuantity] = useState('1');
  const [mode, setMode] = useState<QuantityMode>('servings');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      validateCalendarDate(scalar(params.date) ?? localCalendarDate());
      const result = id ? await entries.get(id) : foodId ? await foods.get(foodId) : null;
      if (!result) throw new Error(id ? 'Entry not found.' : 'Select a food from the catalog.');
      if ('eaten_at' in result && result.eaten_at) throw new Error('Eaten plans are read-only. Edit the consumed entry in the diary instead.');
      if (!active) return;
      setSnapshot(result);
      if ('entry_date' in result) { setDate(result.entry_date); setMeal(result.meal); setQuantity(result.quantity.toString()); setMode(result.quantity_mode); }
      setLoading(false);
    }
    load().catch((failure) => { if (active) { setLoadError(foodErrorMessage(failure, 'မှတ်တမ်းကို ဖတ်ယူ၍မရပါ။ ပြန်လည်ကြိုးစားပါ။')); setLoading(false); } });
    return () => { active = false; };
  }, [entries, foods, id, foodId, params.date, attempt]);

  const input: DiaryInput = { date, meal, quantity: parseFormNumber(quantity), quantity_mode: mode };
  let preview: ReturnType<typeof calculateDiaryNutrition> | null = null;
  let validation = '';
  if (snapshot) {
    try { preview = calculateDiaryNutrition(snapshot, input); }
    catch (failure) { validation = foodErrorMessage(failure, 'စားသုံးပမာဏကို ပြန်စစ်ပါ။'); }
  }
  async function save() {
    if (savingRef.current) return;
    if (!preview || !snapshot) { setError(validation || 'အစားအစာအရင်ရွေးပါ။'); return; }
    savingRef.current = true; setSaving(true); setError('');
    try {
      if (id) await entries.update(id, input);
      else await entries.addEntry(snapshot.id, input);
      router.dismissTo({ pathname: planning ? '/plans' : '/diary', params: { date } });
    } catch { setError('မှတ်တမ်းကို သိမ်းဆည်း၍မရပါ။ ပြင်ဆင်ထားသည့်အချက်များ မပျောက်ပါ။ ပြန်လည်ကြိုးစားပါ။'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  if (loading) return <View style={styles.status}><ActivityIndicator accessibilityLabel={foodText.loading} color={theme.colors.accent} /></View>;
  if (loadError || !snapshot) return <View style={styles.status}><Text accessibilityRole="alert" style={styles.error}>{loadError}</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => { setLoadError(''); setLoading(true); setAttempt((value) => value + 1); }}><Text style={styles.buttonText}>{foodText.retry}</Text></Pressable></View>;

  return <SafeAreaView edges={['left', 'right']} style={styles.screen}>
      <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>{displayFoodName(snapshot)}</Text>
        <Text style={styles.body}>{foodAmount(snapshot.serving_amount, snapshot.serving_unit)} အတွက် {snapshot.calories === null ? foodText.unavailable : caloriesLabel(snapshot.calories)}</Text>
        {snapshot.source === 'bundled' && (!('nutrition_status' in snapshot) || isDevelopmentFood(snapshot)) ? <Text style={styles.error}>{foodText.demoWarning}</Text> : null}
        {id ? <Text style={styles.detail}>စတင်မှတ်တမ်းတင်စဉ်က အာဟာရအချက်အလက်ကို သိမ်းထားပါသည်။</Text> : null}
        <View style={styles.field}><Text style={styles.label}>ရက်စွဲ</Text><DiaryDateField value={date} onChange={setDate} disabled={saving} /></View>
        <DiaryMealField value={meal} onChange={setMeal} disabled={saving} />
        <View style={diaryStyles.controls}>
          {(['servings', 'amount'] as const).map((choice) => <Pressable key={choice} accessibilityRole="radio" accessibilityState={{ checked: mode === choice, disabled: saving }}
            disabled={saving} style={[styles.option, diaryStyles.control, mode === choice ? styles.selected : undefined]}
            onPress={() => {
              if (choice === mode) return;
              setQuantity(preview ? String(choice === 'amount' ? preview.amount : preview.amount / snapshot.serving_amount) : '1');
              setMode(choice); setError('');
            }}>
            <Text style={styles.body}>{choice === 'servings' ? 'အပွဲအရေအတွက်' : foodText.amount}</Text></Pressable>)}
        </View>
        <FoodField label={mode === 'servings' ? 'အပွဲအရေအတွက်' : foodText.amount} value={quantity} numeric disabled={saving}
          onChange={(value) => { setQuantity(value); setError(''); }} error={validation} />
        {preview ? <View style={styles.field}>
          <Text style={styles.nutrition}>{caloriesLabel(preview.calories)}</Text>
          <Text style={styles.detail}>{foodAmount(preview.amount, snapshot.serving_unit)}</Text>
        </View> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving || !preview }} disabled={saving || !preview} style={[styles.button, saving || !preview ? styles.disabled : undefined]} onPress={save}>
          <Text style={styles.buttonText}>{saving ? foodText.saving : id ? foodText.save : planning ? 'အစီအစဉ်တွင် ထည့်ရန်' : 'စားသုံးမှု မှတ်တမ်းတင်ရန်'}</Text></Pressable>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
  </SafeAreaView>;
}
