import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { BookOpen, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { caloriesLabel, DiaryDateField, DiaryIconButton, diaryStyles, mealLabel } from '@/components/diaryUi';
import { foodStyles as styles } from '@/components/foodUi';
import { useRepositories } from '@/data/DatabaseProvider';
import { dailyTotals, localCalendarDate, meals, shiftCalendarDate, validateCalendarDate, type DiaryEntry, type Meal } from '@/domain/diary';
import { theme } from '@/theme/theme';

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
      } catch { if (active) { setError('Could not load this day. Please try again.'); setLoading(false); } }
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
    catch { setError('Could not delete this entry. Please try again.'); }
    finally { setDeleting(null); }
  }
  if (!validDate) return <View style={styles.status}><Text style={styles.error}>Invalid diary date.</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.setParams({ date: localCalendarDate() })}><Text style={styles.buttonText}>Go to today</Text></Pressable></View>;

  const entries = result.date === date ? result.entries : [];
  const totals = dailyTotals(entries);
  const busy = loading || (result.date !== date && !error);
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={ui.heading}>
        <BookOpen size={24} color={theme.colors.accent} />
        <Text accessibilityRole="header" style={styles.title}>Eaten meals</Text>
      </View>
      <View style={diaryStyles.dateRow}>
        <DiaryIconButton icon={ChevronLeft} label="Previous day" disabled={date === '1900-01-01'} onPress={() => selectDate(shiftCalendarDate(date, -1))} />
        <DiaryDateField value={date} onChange={selectDate} />
        <DiaryIconButton icon={ChevronRight} label="Next day" disabled={date === '2100-12-31'} onPress={() => selectDate(shiftCalendarDate(date, 1))} />
      </View>
      {date !== localCalendarDate() ? <Pressable accessibilityRole="button" style={ui.today} onPress={() => selectDate(localCalendarDate())}><Text style={ui.actionText}>Today</Text></Pressable> : null}
      <View style={ui.total}>
        <Text style={styles.detail}>Consumed</Text>
        {busy ? <ActivityIndicator accessibilityLabel="Loading diary" color={theme.colors.accent} />
          : error ? <Text style={styles.body}>Unavailable</Text> : <Text style={styles.nutrition}>{caloriesLabel(totals.total)}</Text>}
      </View>
      {error ? <><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setRetry((value) => value + 1)}><Text style={styles.buttonText}>Try again</Text></Pressable></> : null}
      {!busy && !error ? meals.map((meal) => <View key={meal} style={diaryStyles.section}>
        <View style={diaryStyles.mealHeader}>
          <Text accessibilityRole="header" style={[styles.label, diaryStyles.grow]}>{mealLabel(meal)}</Text>
          <Text style={styles.body}>{caloriesLabel(totals.byMeal[meal])}</Text>
          <DiaryIconButton icon={Plus} label={`Add food to ${meal}`} onPress={() => add(meal)} />
        </View>
        {entries.filter((entry) => entry.meal === meal).map((entry) => <View key={entry.id} style={diaryStyles.entryRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${entry.name}`} disabled={Boolean(deleting)} style={diaryStyles.entry}
            onPress={() => router.push({ pathname: '/diary/edit', params: { id: entry.id, date: entry.entry_date, meal: entry.meal } })}>
            <View style={ui.foodRow}><Text style={[styles.label, diaryStyles.grow]}>{entry.name}</Text>
              <Text style={styles.body}>{caloriesLabel(entry.total_calories)}</Text></View>
            <Text style={styles.detail}>{entry.quantity_mode === 'servings' ? `${entry.quantity} servings` : `${entry.quantity} ${entry.serving_unit}`}</Text>
            {entry.source === 'bundled' ? <Text style={styles.detail}>Unverified development sample</Text> : null}
          </Pressable>
          <DiaryIconButton icon={Trash2} label={`Delete ${entry.name}`} disabled={Boolean(deleting)} onPress={() => Alert.alert('Delete diary entry?', entry.name, [
            { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => remove(entry) },
          ])} />
        </View>)}
        {!entries.some((entry) => entry.meal === meal) ? <Text style={styles.detail}>Nothing logged yet</Text> : null}
      </View>) : null}
    </ScrollView>
  </SafeAreaView>;
}

const ui = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  total: { paddingVertical: 12, borderBottomWidth: 2, borderColor: theme.colors.accent, gap: 4 },
  today: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  actionText: { fontSize: 16, fontWeight: '600', color: theme.colors.accent },
  foodRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
});
