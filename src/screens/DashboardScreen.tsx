import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, BookOpen, Search, UserRound, CalendarClock, ChartNoAxesCombined } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { caloriesLabel, diaryStyles, mealLabel } from '@/components/diaryUi';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppCard } from '@/components/ui/AppCard';
import { CalorieProgressRing } from '@/components/ui/CalorieProgressRing';
import { DateNavigator } from '@/components/ui/DateNavigator';
import { foodStyles } from '@/components/foodUi';
import { useRepositories } from '@/data/DatabaseProvider';
import type { Repositories } from '@/data/repositories';
import { localCalendarDate, meals } from '@/domain/diary';
import { homeDestinations } from '@/navigation/navigation';
import { theme } from '@/theme/theme';

type Day = Awaited<ReturnType<Repositories['dashboard']['getDay']>>;
function balanceLabel(value: number) {
  return value > 0 && value < 0.1 ? '<0.1 kcal' : caloriesLabel(value);
}

export function DashboardScreen() {
  const repositories = useRepositories();
  const router = useRouter();
  const [date, setDate] = useState(localCalendarDate);
  const [result, setResult] = useState<{ date: string; day: Day } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    let request = 0;
    async function load() {
      const current = ++request;
      try {
        const day = await repositories.dashboard.getDay(date);
        if (active && current === request) { setResult({ date, day }); setError(''); }
      } catch {
        if (active && current === request) setError('Could not load your daily summary. Please try again.');
      }
    }
    // Subscribe before reading so a committed edit cannot be missed during a refresh.
    const unsubscribe = repositories.subscribe(() => { void load(); });
    void Promise.resolve().then(() => { if (active) { setError(''); void load(); } });
    return () => { active = false; unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Retry intentionally reloads persisted data.
  }, [repositories, date, retry]));

  const day = result?.date === date ? result.day : null;
  const progress = day?.progress;
  const over = progress?.state === 'over';
  function selectDate(value: string) {
    if (value === date) setRetry((current) => current + 1);
    else { setError(''); setDate(value); }
  }

  return <SafeAreaView edges={['top', 'left', 'right']} style={foodStyles.screen}>
    <ScrollView contentContainerStyle={foodStyles.content}>
      <AppHeader title="Home" subtitle="Calorie Counter" />
      <DateNavigator value={date} onChange={selectDate} />
      {date !== localCalendarDate() ? <Pressable accessibilityRole="button" onPress={() => selectDate(localCalendarDate())} style={styles.today}><Text style={styles.link}>Today</Text></Pressable> : null}
      {error ? <View style={foodStyles.field}>
        <Text accessibilityRole="alert" style={foodStyles.error}>{error}</Text>
        <Pressable accessibilityRole="button" style={foodStyles.button} onPress={() => setRetry((current) => current + 1)}><Text style={foodStyles.buttonText}>Try again</Text></Pressable>
      </View> : !day ? <ActivityIndicator accessibilityLabel="Loading daily summary" color={theme.colors.accent} /> : <>
        <AppCard style={styles.summary}>
          <Text style={foodStyles.label}>{progress ? over ? 'Over target' : progress.state === 'reached' ? 'Target reached' : 'Remaining' : 'Calories consumed'}</Text>
          <Text accessibilityLiveRegion="polite" style={[styles.balance, over && styles.warning]}>
            {progress ? progress.state === 'reached' ? '0 kcal remaining' : balanceLabel(over ? progress.over : progress.remaining) : caloriesLabel(day.totals.total)}
          </Text>
          {progress ? <>
            <CalorieProgressRing progress={progress.fraction} value={caloriesLabel(progress.consumed)} caption={`of ${caloriesLabel(progress.target)}`}
              overTarget={over} accessibilityLabel={`Daily calorie progress${over ? `, ${balanceLabel(progress.over)} over target` : ''}`} />
            <View style={styles.metrics}>
              <View style={styles.metric}><Text style={foodStyles.detail}>Consumed</Text><Text style={foodStyles.label}>{caloriesLabel(progress.consumed)}</Text></View>
              <View style={styles.metric}><Text style={foodStyles.detail}>Daily target</Text><Text style={foodStyles.label}>{caloriesLabel(progress.target)}</Text></View>
            </View>
            <Text style={foodStyles.detail}>Current profile target; calorie needs are estimates.</Text>
          </> : <>
            <Text style={foodStyles.body}>No daily target set.</Text>
            <Pressable accessibilityRole="button" style={foodStyles.button} onPress={() => router.push('/goal-settings')}><Text style={foodStyles.buttonText}>Set calorie target</Text></Pressable>
          </>}
        </AppCard>
      </>}
      <View style={styles.shortcuts}>
        {homeDestinations(date).slice(0, 2).map((destination) => {
          const planned = destination.key === 'plans';
          const Icon = planned ? CalendarClock : BookOpen;
          return <Pressable key={destination.key} accessibilityRole="button" onPress={() => router.push(destination.href)}
            style={({ pressed }) => [styles.shortcut, planned ? styles.planningShortcut : styles.diaryShortcut, pressed && styles.pressed]}>
            <Icon size={28} color={planned ? theme.colors.planning : theme.colors.accent} />
            <Text style={styles.destinationLabel}>{destination.label}</Text>
            <Text style={foodStyles.detail}>{planned ? 'Upcoming' : 'Eaten'}</Text>
          </Pressable>;
        })}
      </View>
      <View>
        {homeDestinations(date).slice(2).map((destination) => {
          const Icon = { diary: BookOpen, plans: CalendarClock, foods: Search, history: ChartNoAxesCombined, profile: UserRound }[destination.key];
          return <Pressable key={destination.key} accessibilityRole="button" onPress={() => router.push(destination.href)}
            style={({ pressed }) => [styles.destination, pressed && styles.pressed]}>
            <Icon size={20} color={theme.colors.secondaryText} />
            <Text style={styles.secondaryLabel}>{destination.label}</Text>
            <ChevronRight size={18} color={theme.colors.secondaryText} />
          </Pressable>;
        })}
      </View>
      {day && !error ? <>
        <Text accessibilityRole="header" style={foodStyles.label}>Eaten meals</Text>
        {meals.map((meal) => {
          const entries = day.entries.filter((entry) => entry.meal === meal);
          return <View style={styles.mealRow} key={meal}>
            <Text style={[foodStyles.body, diaryStyles.grow]}>{mealLabel(meal)}</Text>
            <Text style={foodStyles.detail}>{entries.length ? caloriesLabel(day.totals.byMeal[meal]) : 'Not logged'}</Text>
          </View>;
        })}
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  today: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 12 },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  shortcut: { flexGrow: 1, flexBasis: 145, gap: 10, padding: 16, borderRadius: theme.radius.card, minHeight: 132 },
  diaryShortcut: { backgroundColor: theme.colors.accentSurface },
  planningShortcut: { backgroundColor: theme.colors.planningSurface },
  destination: { minHeight: 52, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: theme.colors.border },
  destinationLabel: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: theme.colors.text },
  secondaryLabel: { flex: 1, fontSize: 16, lineHeight: 24, color: theme.colors.text },
  pressed: { opacity: 0.6 },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 },
  link: { color: theme.colors.accent, fontSize: 17, fontWeight: '600', flexShrink: 1 },
  summary: { gap: 12 },
  balance: { color: theme.colors.accent, fontSize: 30, lineHeight: 38, fontWeight: '700' },
  warning: { color: theme.colors.warning },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  metric: { flexGrow: 1, flexBasis: 120, gap: 4 },
});
