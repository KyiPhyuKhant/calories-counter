import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react-native';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { caloriesLabel, DiaryDateField, DiaryIconButton, diaryStyles, mealLabel } from '@/components/diaryUi';
import { foodStyles as styles } from '@/components/foodUi';
import { useRepositories } from '@/data/DatabaseProvider';
import type { PlannedFood } from '@/data/planRepository';
import { calorieProgress, summarizeDashboard } from '@/domain/dashboard';
import { dailyTotals, localCalendarDate, meals, shiftCalendarDate, validateCalendarDate, type Meal } from '@/domain/diary';
import { theme } from '@/theme/theme';

export function PlanScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const [openedDate] = useState(() => shiftCalendarDate(localCalendarDate(), 1));
  const date = typeof params.date === 'string' ? params.date : openedDate;
  const repositories = useRepositories();
  const router = useRouter();
  const [result, setResult] = useState<{ date: string; entries: PlannedFood[]; target: number | null } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<'copy' | Meal | null>(null);
  const [source, setSource] = useState(localCalendarDate);
  const [destination, setDestination] = useState(openedDate);
  const [eatenDate, setEatenDate] = useState(localCalendarDate);
  const [actionError, setActionError] = useState('');
  let validDate = true;
  try { validateCalendarDate(date); } catch { validDate = false; }

  useFocusEffect(useCallback(() => {
    let active = true;
    let request = 0;
    async function load() {
      if (!validDate) return;
      const current = ++request;
      try {
        const entries = await repositories.plans.listDay(date);
        const profile = await repositories.profiles.get();
        const target = summarizeDashboard(profile, []).progress?.target ?? null;
        if (active && current === request) { setResult({ date, entries, target }); setError(''); }
      } catch { if (active && current === request) setError('Could not load this plan. Please try again.'); }
    }
    const unsubscribe = repositories.subscribe(() => { void load(); });
    void Promise.resolve().then(() => { if (active) { setError(''); void load(); } });
    return () => { active = false; unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Retry intentionally reloads saved plans.
  }, [repositories, date, validDate, retry]));

  function selectDate(value: string) {
    setError('');
    if (value === date) setRetry((current) => current + 1);
    else router.setParams({ date: value });
  }
  async function remove(plan: PlannedFood) {
    setBusy(true); setError('');
    try { await repositories.plans.remove(plan.id); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not delete this planned food.'); }
    finally { setBusy(false); }
  }
  async function confirmAction() {
    if (!action || busy) return;
    setBusy(true); setActionError('');
    try {
      if (action === 'copy') {
        await repositories.plans.copyDay(source, destination);
        selectDate(destination);
      } else {
        const count = await repositories.plans.markMealEaten(date, action, eatenDate);
        Alert.alert('Meal logged', count ? `${count} planned food${count === 1 ? '' : 's'} logged on ${eatenDate}.` : 'This meal was already logged.');
      }
      setAction(null);
    } catch (failure) { setActionError(failure instanceof Error ? failure.message : 'Could not complete this action. Please try again.'); }
    finally { setBusy(false); }
  }
  if (!validDate) return <View style={styles.status}><Text style={styles.error}>Invalid planning date.</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => selectDate(openedDate)}><Text style={styles.buttonText}>Go to tomorrow</Text></Pressable></View>;

  const day = result?.date === date ? result : null;
  const totals = dailyTotals(day?.entries ?? []);
  const progress = day?.target ? calorieProgress(day.target, totals.total) : null;

  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={diaryStyles.dateRow}>
        <DiaryIconButton icon={ChevronLeft} label="Previous planning day" disabled={busy || date === '1900-01-01'} onPress={() => selectDate(shiftCalendarDate(date, -1))} />
        <DiaryDateField value={date} onChange={selectDate} disabled={busy} />
        <DiaryIconButton icon={ChevronRight} label="Next planning day" disabled={busy || date === '2100-12-31'} onPress={() => selectDate(shiftCalendarDate(date, 1))} />
      </View>
      <View style={diaryStyles.controls}>
        <Pressable accessibilityRole="button" disabled={busy} style={[styles.option, diaryStyles.control]} onPress={() => selectDate(shiftCalendarDate(localCalendarDate(), 1))}><Text style={styles.body}>Tomorrow</Text></Pressable>
        <DiaryIconButton icon={Copy} label="Copy a day's plan" disabled={busy} onPress={() => {
          setSource(date === '1900-01-01' ? date : shiftCalendarDate(date, -1)); setDestination(date); setActionError(''); setAction('copy');
        }} />
      </View>
      {error ? <View style={styles.field}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setRetry((current) => current + 1)}><Text style={styles.buttonText}>Try again</Text></Pressable></View>
        : !day ? <ActivityIndicator accessibilityLabel="Loading meal plan" color={theme.colors.accent} /> : <>
          <View style={styles.field}>
            <Text accessibilityRole="header" style={styles.title}>Planned day</Text>
            <Text style={styles.nutrition}>{caloriesLabel(totals.total)}</Text>
            {progress ? <>
              <Text style={styles.body}>Daily target: {caloriesLabel(progress.target)}</Text>
              <Text style={progress.state === 'over' ? styles.error : styles.detail}>{progress.state === 'reached' ? 'Plan meets target' : `${caloriesLabel(Math.abs(progress.remaining))} ${progress.state === 'over' ? 'over' : 'below'} target`}</Text>
              <Text style={styles.detail}>Current profile target; calorie needs are estimates.</Text>
            </> : <Pressable accessibilityRole="button" style={styles.option} onPress={() => router.push('/profile')}><Text style={styles.body}>Set calorie target</Text></Pressable>}
            <Text style={styles.detail}>Planned calories, including eaten items.</Text>
          </View>
          {meals.map((meal) => {
            const entries = day.entries.filter((plan) => plan.meal === meal);
            const pending = entries.some((plan) => !plan.eaten_at);
            return <View key={meal} style={diaryStyles.section}>
              <View style={diaryStyles.mealHeader}>
                <Text accessibilityRole="header" style={[styles.label, diaryStyles.grow]}>{mealLabel(meal)}</Text>
                <Text style={styles.body}>{caloriesLabel(totals.byMeal[meal])}</Text>
                <DiaryIconButton icon={Plus} label={`Plan food for ${meal}`} disabled={busy} onPress={() => router.push({ pathname: '/plans/select', params: { date, meal } })} />
              </View>
              {entries.map((plan) => <View key={plan.id} style={diaryStyles.entryRow}>
                <Pressable accessibilityRole="button" disabled={busy || Boolean(plan.eaten_at && !plan.diary_entry_id)} style={diaryStyles.entry}
                  accessibilityLabel={plan.eaten_at ? `View consumed ${plan.name}` : `Edit planned ${plan.name}`}
                  onPress={() => router.push({ pathname: plan.eaten_at ? '/diary/edit' : '/plans/edit', params: { id: plan.eaten_at ? plan.diary_entry_id! : plan.id, date: plan.eaten_date ?? date, meal } })}>
                  <Text style={styles.label}>{plan.name}</Text>
                  <Text style={styles.body}>{caloriesLabel(plan.total_calories)}</Text>
                  <Text style={styles.detail}>{plan.quantity} {plan.quantity_mode === 'servings' ? 'servings' : plan.serving_unit}</Text>
                  {plan.eaten_at ? <Text style={styles.detail}>Eaten on {plan.eaten_date}{plan.diary_entry_id ? '' : ' (diary entry deleted)'}</Text> : null}
                  {plan.source === 'bundled' ? <Text style={styles.detail}>Unverified development sample</Text> : null}
                </Pressable>
                {!plan.eaten_at ? <DiaryIconButton icon={Trash2} label={`Delete planned ${plan.name}`} disabled={busy} onPress={() => Alert.alert('Delete planned food?', plan.name, [
                  { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => remove(plan) },
                ])} /> : null}
              </View>)}
              {!entries.length ? <Text style={styles.detail}>No foods planned.</Text> : <View style={diaryStyles.controls}>
                <DiaryIconButton icon={Check} label={`Mark ${meal} eaten`} disabled={busy || !pending} onPress={() => { setEatenDate(localCalendarDate()); setActionError(''); setAction(meal); }} />
                <Text style={[styles.detail, diaryStyles.grow]}>{pending ? 'Not yet eaten' : 'Meal logged'}</Text>
              </View>}
            </View>;
          })}
        </>}
    </ScrollView>
    <Modal visible={action !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!busy) setAction(null); }}>
      <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>{action === 'copy' ? 'Copy day plan' : action ? `Mark ${mealLabel(action)} eaten` : 'Meal plan'}</Text>
        {action === 'copy' ? <>
          <Text style={styles.label}>Copy from</Text><DiaryDateField value={source} onChange={setSource} disabled={busy} />
          <Text style={styles.label}>Copy to</Text><DiaryDateField value={destination} onChange={setDestination} disabled={busy} />
        </> : <><Text style={styles.label}>Date eaten</Text><DiaryDateField value={eatenDate} onChange={setEatenDate} disabled={busy} /></>}
        <Pressable accessibilityRole="button" disabled={busy} style={[styles.button, busy && styles.disabled]} onPress={confirmAction}><Text style={styles.buttonText}>{busy ? 'Saving...' : action === 'copy' ? 'Copy plan' : 'Log meal in diary'}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} style={styles.option} onPress={() => setAction(null)}><Text style={styles.body}>Cancel</Text></Pressable>
        {actionError ? <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text> : null}
      </ScrollView></SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
