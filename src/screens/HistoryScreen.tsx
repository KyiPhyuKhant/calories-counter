import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { caloriesLabel, DiaryDateField, DiaryIconButton, diaryStyles } from '@/components/diaryUi';
import { foodStyles as styles } from '@/components/foodUi';
import { HistoryChart } from '@/components/HistoryChart';
import { useRepositories } from '@/data/DatabaseProvider';
import type { Repositories } from '@/data/repositories';
import type { WeightEntry } from '@/data/weightRepository';
import { localCalendarDate, validateCalendarDate } from '@/domain/diary';
import { historyRange, shiftHistoryPeriod } from '@/domain/history';
import { theme } from '@/theme/theme';

type History = Awaited<ReturnType<Repositories['history']['getPeriod']>>;
const kg = (value: number | null) => value === null ? 'No measurements' : `${Number(value.toFixed(2))} kg`;

export function HistoryScreen() {
  const params = useLocalSearchParams<{ date?: string; period?: string; view?: string }>();
  const [openedDate] = useState(localCalendarDate);
  const date = typeof params.date === 'string' ? params.date : openedDate;
  const period = params.period === 'month' ? 'month' : 'week';
  const view = params.view === 'calories' ? 'calories' : 'weight';
  const repositories = useRepositories(); const router = useRouter();
  const [result, setResult] = useState<{ key: string; history: History } | null>(null);
  const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showMeasurements, setShowMeasurements] = useState(false);
  let valid = true; try { validateCalendarDate(date); } catch { valid = false; }
  const key = `${period}:${date}`;
  useFocusEffect(useCallback(() => {
    let active = true; let request = 0;
    async function load() {
      if (!valid) return;
      const current = ++request;
      try {
        const history = await repositories.history.getPeriod(date, period);
        if (active && current === request) { setResult({ key, history }); setError(''); }
      } catch { if (active && current === request) setError('Could not load your history. Please try again.'); }
    }
    const unsubscribe = repositories.subscribe(() => { void load(); });
    void Promise.resolve().then(() => { if (active) { setError(''); void load(); } });
    return () => { active = false; unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Retry intentionally reloads persisted history.
  }, [repositories, date, period, key, valid, retry]));
  function selectDate(value: string) {
    setError('');
    if (date === value) setRetry((current) => current + 1); else router.setParams({ date: value });
  }
  async function remove(entry: WeightEntry) {
    if (deleting) return;
    setDeleting(entry.id); setError('');
    try { await repositories.weights.remove(entry.id); }
    catch { setError('Could not delete this measurement. Please try again.'); }
    finally { setDeleting(null); }
  }
  if (!valid) return <View style={styles.status}><Text style={styles.error}>Invalid history date.</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => selectDate(localCalendarDate())}><Text style={styles.buttonText}>Go to today</Text></Pressable></View>;
  const range = historyRange(date, period);
  const history = result?.key === key ? result.history : null;
  const summary = history?.summary;
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.screen}>
    <ScrollView contentContainerStyle={[styles.content, historyStyles.content]}>
      <View style={historyStyles.segmented}>
        {(['week', 'month'] as const).map((choice) => <Pressable key={choice} accessibilityRole="radio" accessibilityState={{ checked: period === choice }}
          style={[historyStyles.segment, period === choice && historyStyles.activeSegment]} onPress={() => { setError(''); router.setParams({ period: choice }); }}><Text style={historyStyles.segmentLabel}>{choice === 'week' ? 'Weekly' : 'Monthly'}</Text></Pressable>)}
      </View>
      <View style={diaryStyles.dateRow}>
        <DiaryIconButton icon={ChevronLeft} label={`Previous ${period}`} disabled={range.start === '1900-01-01'} onPress={() => selectDate(shiftHistoryPeriod(date, period, -1))} />
        <DiaryDateField value={date} onChange={selectDate} />
        <DiaryIconButton icon={ChevronRight} label={`Next ${period}`} disabled={range.end === '2100-12-31'} onPress={() => selectDate(shiftHistoryPeriod(date, period, 1))} />
      </View>
      <Text style={styles.detail}>{range.start} to {range.end}</Text>
      {date !== localCalendarDate() ? <Pressable accessibilityRole="button" style={historyStyles.today} onPress={() => selectDate(localCalendarDate())}><Text style={historyStyles.link}>Today</Text></Pressable> : null}
      <View style={historyStyles.segmented}>
        {(['weight', 'calories'] as const).map((choice) => <Pressable key={choice} accessibilityRole="tab" accessibilityState={{ selected: view === choice }}
          style={[historyStyles.segment, view === choice && historyStyles.activeSegment]} onPress={() => router.setParams({ view: choice })}><Text style={historyStyles.segmentLabel}>{choice === 'weight' ? 'Weight' : 'Calories'}</Text></Pressable>)}
      </View>
      {error ? <View style={styles.field}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setRetry((current) => current + 1)}><Text style={styles.buttonText}>Try again</Text></Pressable></View>
        : !history || !summary ? <ActivityIndicator accessibilityLabel="Loading history" color={theme.colors.accent} /> : view === 'weight' ? <>
          <View style={diaryStyles.mealHeader}><Text accessibilityRole="header" style={[styles.title, diaryStyles.grow]}>Weight history</Text>
            <DiaryIconButton icon={Plus} label="Record weight measurement" onPress={() => router.push({ pathname: '/history/weight', params: { date: date > localCalendarDate() ? localCalendarDate() : date, period } })} /></View>
          <HistoryChart key={`weight:${key}`} days={history.days} kind="weight" />
          <View style={historyStyles.metrics}>
            <View style={historyStyles.metric}><Text style={styles.detail}>Average</Text><Text style={styles.label}>{kg(summary.averageWeight)}</Text></View>
            <View style={historyStyles.metric}><Text style={styles.detail}>Change</Text><Text style={styles.label}>{summary.weightChange === null ? 'Unavailable' : `${summary.weightChange > 0 ? '+' : ''}${kg(summary.weightChange)}`}</Text></View>
          </View>
          {history.weights.length ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: showMeasurements }} style={historyStyles.disclosure}
            onPress={() => setShowMeasurements((value) => !value)}>
            <Text style={[styles.label, diaryStyles.grow]}>Measurements ({summary.measurements})</Text>
            {showMeasurements ? <ChevronUp size={20} color={theme.colors.accent} /> : <ChevronDown size={20} color={theme.colors.accent} />}
          </Pressable> : null}
          {showMeasurements ? history.weights.map((entry) => <View key={entry.id} style={diaryStyles.section}>
            <View style={diaryStyles.entryRow}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${kg(entry.weight_kg)} on ${entry.measured_date}`} disabled={Boolean(deleting)} style={diaryStyles.entry}
                onPress={() => router.push({ pathname: '/history/weight', params: { id: entry.id, date: entry.measured_date, period } })}>
                <Text style={styles.label}>{entry.measured_date}</Text><Text style={styles.body}>{kg(entry.weight_kg)}</Text>
              </Pressable>
              <DiaryIconButton icon={Trash2} label={`Delete weight on ${entry.measured_date}`} disabled={Boolean(deleting)} onPress={() => Alert.alert('Delete measurement?', `${entry.measured_date}: ${kg(entry.weight_kg)}`, [
                { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => remove(entry) },
              ])} />
            </View>
          </View>) : null}
        </> : <>
          <Text accessibilityRole="header" style={styles.title}>Calorie history</Text>
          <HistoryChart key={`calories:${key}`} days={history.days} kind="calories" />
          <View style={historyStyles.metrics}>
            <View style={historyStyles.metric}><Text style={styles.detail}>Daily average</Text><Text style={styles.label}>{summary.averageCalories === null ? 'Unavailable' : caloriesLabel(summary.averageCalories)}</Text></View>
            <View style={historyStyles.metric}><Text style={styles.detail}>Average target</Text><Text style={styles.label}>{summary.averageTarget === null ? 'Unknown' : caloriesLabel(summary.averageTarget)}</Text></View>
          </View>
          <Text style={styles.detail}>{summary.loggedDays} logged days / {summary.elapsedDays} elapsed days</Text>
          <View style={historyStyles.metrics}>
            <Text style={historyStyles.under}>{summary.underDays} under</Text>
            <Text style={historyStyles.at}>{summary.atDays} at target</Text>
            <Text style={historyStyles.over}>{summary.overDays} over</Text>
          </View>
        </>}
    </ScrollView>
  </SafeAreaView>;
}

const historyStyles = StyleSheet.create({
  content: { gap: 16 },
  segmented: { flexDirection: 'row', padding: 4, gap: 4, backgroundColor: theme.colors.border, borderRadius: 8 },
  segment: { flex: 1, minHeight: 44, padding: 8, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
  activeSegment: { backgroundColor: theme.colors.surface },
  segmentLabel: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: theme.colors.text, textAlign: 'center' },
  today: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { fontSize: 17, fontWeight: '600', color: theme.colors.accent },
  under: { fontSize: 16, lineHeight: 24, color: theme.colors.accent },
  over: { fontSize: 16, lineHeight: 24, color: '#99452B' },
  at: { fontSize: 16, lineHeight: 24, color: '#2563A0' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  metric: { flexGrow: 1, flexBasis: 130, gap: 4 },
  disclosure: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
