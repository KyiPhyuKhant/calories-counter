import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { BookOpen, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { caloriesLabel, DiaryDateField, DiaryIconButton, diaryStyles, mealDayStyles as ui, mealLabel } from '@/components/diaryUi';
import { foodStyles as styles } from '@/components/foodUi';
import { useRepositories } from '@/data/DatabaseProvider';
import { dailyTotals, localCalendarDate, meals, shiftCalendarDate, validateCalendarDate, type DiaryEntry, type Meal } from '@/domain/diary';
import { theme } from '@/theme/theme';
import { displayFoodName, foodAmount, foodText } from '@/i18n/foodMy';

export function DiaryScreen() {
  const { date: param } = useLocalSearchParams<{ date?: string | string[] }>();
  const [openedDate] = useState(localCalendarDate);
  const date = (Array.isArray(param) ? param[0] : param) ?? openedDate;
  const { diary } = useRepositories();
  const router = useRouter();
  const [result, setResult] = useState<{ date: string; entries: DiaryEntry[] }>({ date: '', entries: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  let validDate = true;
  try { validateCalendarDate(date); } catch { validDate = false; }

  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.resolve().then(async () => {
      if (!active || !validDate) return;
      setLoading(true); setError('');
      try {
        const entries = await diary.listDay(date);
        if (active) { setResult({ date, entries }); setLoading(false); }
      } catch { if (active) { setError('ဤနေ့၏မှတ်တမ်းကို ဖတ်ယူ၍မရပါ။ ပြန်လည်ကြိုးစားပါ။'); setLoading(false); } }
    });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Explicit retry must reload the selected day.
  }, [diary, date, validDate, retry]));

  function selectDate(value: string) {
    if (value === date) { setRetry((current) => current + 1); return; }
    setLoading(true); router.setParams({ date: value });
  }
  function add(meal: Meal) { router.push({ pathname: '/diary/select', params: { date, meal } }); }
  async function remove(entry: DiaryEntry) {
    if (deleting) return;
    setDeleting(entry.id); setError('');
    try { await diary.remove(entry.id); setRetry((value) => value + 1); }
    catch { setError('ဤမှတ်တမ်းကို ဖျက်၍မရပါ။ ပြန်လည်ကြိုးစားပါ။'); }
    finally { setDeleting(null); }
  }
  if (!validDate) return <View style={styles.status}><Text style={styles.error}>{foodText.invalidDate}</Text>
    <Pressable accessibilityRole="button" style={ui.confirmButton} onPress={() => router.setParams({ date: localCalendarDate() })}><Text style={ui.confirmText}>ယနေ့သို့ ပြန်ရန်</Text></Pressable></View>;

  const entries = result.date === date ? result.entries : [];
  const totals = dailyTotals(entries);
  const busy = loading || (result.date !== date && !error);
  return <SafeAreaView edges={['left', 'right']} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={ui.heading}>
        <BookOpen size={24} color={theme.colors.accent} />
        <Text accessibilityRole="header" style={ui.title}>စားသုံးမှုမှတ်တမ်း</Text>
      </View>
      <View style={diaryStyles.dateRow}>
        <DiaryIconButton icon={ChevronLeft} label="ယခင်နေ့" disabled={date === '1900-01-01'} onPress={() => selectDate(shiftCalendarDate(date, -1))} />
        <DiaryDateField value={date} onChange={selectDate} />
        <DiaryIconButton icon={ChevronRight} label="နောက်နေ့" disabled={date === '2100-12-31'} onPress={() => selectDate(shiftCalendarDate(date, 1))} />
      </View>
      {date !== localCalendarDate() ? <Pressable accessibilityRole="button" style={ui.toolbarButton} onPress={() => selectDate(localCalendarDate())}><Text style={ui.actionText}>ယနေ့</Text></Pressable> : null}
      <View style={ui.summary}>
        <Text style={styles.detail}>စားသုံးပြီး</Text>
        {busy ? <ActivityIndicator accessibilityLabel={foodText.loading} color={theme.colors.accent} />
          : error ? <Text style={styles.body}>ဖတ်ယူ၍မရပါ</Text> : <Text style={styles.nutrition}>{caloriesLabel(totals.total)}</Text>}
      </View>
      {error ? <><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        <Pressable accessibilityRole="button" style={ui.confirmButton} onPress={() => setRetry((value) => value + 1)}><Text style={ui.confirmText}>{foodText.retry}</Text></Pressable></> : null}
      {!busy && !error ? meals.map((meal) => <View key={meal} style={ui.mealCard}>
        <View style={diaryStyles.mealHeader}>
          <Text accessibilityRole="header" style={[styles.label, diaryStyles.grow]}>{mealLabel(meal)}</Text>
          <Text style={styles.body}>{caloriesLabel(totals.byMeal[meal])}</Text>
        </View>
        {entries.filter((entry) => entry.meal === meal).map((entry) => <View key={entry.id} style={diaryStyles.entryRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${displayFoodName(entry)}ကို ပြင်ရန်`} disabled={Boolean(deleting)} style={diaryStyles.entry}
            onPress={() => router.push({ pathname: '/diary/edit', params: { id: entry.id, date: entry.entry_date, meal: entry.meal } })}>
            <View style={diaryStyles.mealHeader}><Text style={[styles.label, diaryStyles.grow]}>{displayFoodName(entry)}</Text>
              <Text style={styles.body}>{caloriesLabel(entry.total_calories)}</Text></View>
            <Text style={styles.detail}>{foodAmount(entry.quantity, entry.quantity_mode === 'servings' ? 'serving' : entry.serving_unit)}</Text>
            {entry.source === 'bundled' ? <Text style={styles.detail}>အတည်မပြုထားသော နမူနာ</Text> : null}
          </Pressable>
          <DiaryIconButton icon={Trash2} color={theme.colors.danger} label={`${displayFoodName(entry)}ကို ဖျက်ရန်`} disabled={Boolean(deleting)} onPress={() => Alert.alert('စားသုံးမှုမှတ်တမ်းကို ဖျက်မလား။', displayFoodName(entry), [
            { text: foodText.cancel, style: 'cancel' }, { text: foodText.remove, style: 'destructive', onPress: () => remove(entry) },
          ])} />
        </View>)}
        {!entries.some((entry) => entry.meal === meal) ? <Text style={styles.detail}>မှတ်တမ်းမရှိသေးပါ</Text> : null}
        <View style={ui.cardActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${mealLabel(meal)}တွင် အစားအစာထည့်ရန်`}
            style={ui.toolbarButton} onPress={() => add(meal)}>
            <Plus size={16} color={theme.colors.accent} /><Text style={ui.actionText}>အစားအစာထည့်ရန်</Text>
          </Pressable>
        </View>
      </View>) : null}
    </ScrollView>
  </SafeAreaView>;
}
