import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarClock, Check, ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react-native';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { caloriesLabel, DiaryDateField, DiaryIconButton, diaryStyles, mealLabel } from '@/components/diaryUi';
import { foodStyles as styles } from '@/components/foodUi';
import { useRepositories } from '@/data/DatabaseProvider';
import type { PlannedFood } from '@/data/planRepository';
import { calorieProgress, summarizeDashboard } from '@/domain/dashboard';
import { dailyTotals, localCalendarDate, meals, shiftCalendarDate, validateCalendarDate, type Meal } from '@/domain/diary';
import { theme } from '@/theme/theme';
import { displayFoodName, foodAmount, foodDateLabel, foodErrorMessage, foodText } from '@/i18n/foodMy';

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
      } catch { if (active && current === request) setError('အစီအစဉ်ကို ဖတ်ယူ၍မရပါ။ ပြန်လည်ကြိုးစားပါ။'); }
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
    catch (failure) { setError(foodErrorMessage(failure, 'စီစဉ်ထားသော အစားအစာကို ဖျက်၍မရပါ။')); }
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
        Alert.alert('မှတ်တမ်းတင်ပြီးပါပြီ', count ? `${foodDateLabel(eatenDate)} တွင် အစားအစာ ${count} မျိုးကို မှတ်တမ်းတင်ပြီးပါပြီ။` : 'ဤစားသုံးမှုကို မှတ်တမ်းတင်ပြီးဖြစ်သည်။', [{ text: 'ပိတ်ရန်' }]);
      }
      setAction(null);
    } catch (failure) { setActionError(foodErrorMessage(failure, 'လုပ်ဆောင်၍မရပါ။ ပြန်လည်ကြိုးစားပါ။')); }
    finally { setBusy(false); }
  }
  if (!validDate) return <View style={styles.status}><Text style={styles.error}>{foodText.invalidDate}</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => selectDate(openedDate)}><Text style={styles.buttonText}>မနက်ဖြန်သို့ ပြန်ရန်</Text></Pressable></View>;

  const day = result?.date === date ? result : null;
  const totals = dailyTotals(day?.entries ?? []);
  const progress = day?.target ? calorieProgress(day.target, totals.total) : null;

  return <SafeAreaView edges={['left', 'right']} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={ui.heading}>
        <CalendarClock size={24} color={planningColor} />
        <Text accessibilityRole="header" style={styles.title}>{date > localCalendarDate() ? 'ကြိုတင်စားသောက်အစီအစဉ်' : 'စားသောက်အစီအစဉ်'}</Text>
      </View>
      <View style={diaryStyles.dateRow}>
        <DiaryIconButton icon={ChevronLeft} label="ယခင်နေ့အစီအစဉ်" disabled={busy || date === '1900-01-01'} onPress={() => selectDate(shiftCalendarDate(date, -1))} />
        <DiaryDateField value={date} onChange={selectDate} disabled={busy} />
        <DiaryIconButton icon={ChevronRight} label="နောက်နေ့အစီအစဉ်" disabled={busy || date === '2100-12-31'} onPress={() => selectDate(shiftCalendarDate(date, 1))} />
      </View>
      <View style={diaryStyles.controls}>
        <Pressable accessibilityRole="button" disabled={busy} style={[ui.toolbarButton, diaryStyles.control]} onPress={() => selectDate(shiftCalendarDate(localCalendarDate(), 1))}><Text style={ui.actionText}>မနက်ဖြန်</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} style={ui.toolbarButton} onPress={() => {
          setSource(date === '1900-01-01' ? date : shiftCalendarDate(date, -1)); setDestination(date); setActionError(''); setAction('copy');
        }}><Copy size={18} color={planningColor} /><Text style={ui.actionText}>အစီအစဉ်ကူးရန်</Text></Pressable>
      </View>
      {error ? <View style={styles.field}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setRetry((current) => current + 1)}><Text style={styles.buttonText}>{foodText.retry}</Text></Pressable></View>
        : !day ? <ActivityIndicator accessibilityLabel={foodText.loading} color={theme.colors.accent} /> : <>
          <View style={ui.forecast}>
            <Text style={styles.detail}>စီစဉ်ထားသော ကယ်လိုရီ</Text>
            <Text style={[styles.nutrition, ui.plannedTotal]}>{caloriesLabel(totals.total)}</Text>
            {progress ? <>
              <Text style={styles.body}>ခန့်မှန်းရည်မှန်းချက် — {caloriesLabel(progress.target)}</Text>
              <Text style={progress.state === 'over' ? styles.error : styles.detail}>{progress.state === 'reached' ? 'အစီအစဉ်သည် ရည်မှန်းချက်နှင့် ကိုက်ညီသည်' : `ရည်မှန်းချက်ထက် ${caloriesLabel(Math.abs(progress.remaining))} ${progress.state === 'over' ? 'ပိုနေသည်' : 'လျော့နေသည်'}`}</Text>
            </> : <Pressable accessibilityRole="button" style={[ui.toolbarButton, ui.targetAction]} onPress={() => router.push('/goal-settings')}><Text style={ui.actionText}>ကယ်လိုရီရည်မှန်းချက် သတ်မှတ်ရန်</Text></Pressable>}
            {day.entries.some((entry) => entry.eaten_at) ? <Text style={styles.detail}>မှတ်တမ်းတင်ပြီးသော စားသုံးမှုများ ပါဝင်သည်</Text> : null}
          </View>
          {meals.map((meal) => {
            const entries = day.entries.filter((plan) => plan.meal === meal);
            const pending = entries.some((plan) => !plan.eaten_at);
            return <View key={meal} style={ui.mealCard}>
              <View style={diaryStyles.mealHeader}>
                <Text accessibilityRole="header" style={[styles.label, diaryStyles.grow]}>{mealLabel(meal)}</Text>
                <Text style={styles.body}>{caloriesLabel(totals.byMeal[meal])}</Text>
              </View>
              {entries.map((plan) => <View key={plan.id} style={diaryStyles.entryRow}>
                <Pressable accessibilityRole="button" disabled={busy || Boolean(plan.eaten_at && !plan.diary_entry_id)} style={diaryStyles.entry}
                  accessibilityLabel={plan.eaten_at ? `${displayFoodName(plan)} စားသုံးမှုကို ကြည့်ရန်` : `${displayFoodName(plan)} အစီအစဉ်ကို ပြင်ရန်`}
                  onPress={() => router.push({ pathname: plan.eaten_at ? '/diary/edit' : '/plans/edit', params: { id: plan.eaten_at ? plan.diary_entry_id! : plan.id, date: plan.eaten_date ?? date, meal } })}>
                  <Text style={styles.label}>{displayFoodName(plan)}</Text>
                  <Text style={styles.body}>{caloriesLabel(plan.total_calories)}</Text>
                  <Text style={styles.detail}>{foodAmount(plan.quantity, plan.quantity_mode === 'servings' ? 'serving' : plan.serving_unit)}</Text>
                  {plan.eaten_at ? <Text style={styles.detail}>စားသုံးသည့်ရက် — {plan.eaten_date ? foodDateLabel(plan.eaten_date) : ''}{plan.diary_entry_id ? '' : ' (စားသုံးမှုမှတ်တမ်း ဖျက်ပြီး)'} </Text> : null}
                  {plan.source === 'bundled' ? <Text style={styles.detail}>အတည်မပြုထားသော နမူနာ</Text> : null}
                </Pressable>
                {!plan.eaten_at ? <DiaryIconButton icon={Trash2} label={`${displayFoodName(plan)} အစီအစဉ်ကို ဖျက်ရန်`} disabled={busy} onPress={() => Alert.alert('စီစဉ်ထားသော အစားအစာကို ဖျက်မလား။', displayFoodName(plan), [
                  { text: foodText.cancel, style: 'cancel' }, { text: foodText.remove, style: 'destructive', onPress: () => remove(plan) },
                ])} /> : null}
              </View>)}
              {!entries.length ? <Text style={styles.detail}>အစီအစဉ် မရှိသေးပါ</Text> : <Text style={styles.detail}>{pending ? 'မစားသုံးရသေးပါ' : 'စားသုံးမှုမှတ်တမ်းတွင် ထည့်ပြီး'}</Text>}
              <View style={ui.cardActions}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${mealLabel(meal)}အတွက် အစားအစာစီစဉ်ရန်`} disabled={busy}
                  style={[ui.toolbarButton, busy && styles.disabled]} onPress={() => router.push({ pathname: '/plans/select', params: { date, meal } })}>
                  <Plus size={18} color={planningColor} /><Text style={ui.actionText}>အစားအစာစီစဉ်ရန်</Text>
                </Pressable>
                {pending ? <Pressable accessibilityRole="button" accessibilityLabel={`${mealLabel(meal)}ကို စားပြီးအဖြစ် မှတ်တမ်းတင်ရန်`} disabled={busy}
                  style={[ui.toolbarButton, busy && styles.disabled]} onPress={() => { setEatenDate(localCalendarDate()); setActionError(''); setAction(meal); }}>
                  <Check size={18} color={theme.colors.accent} /><Text style={ui.eatenAction}>စားပြီးအဖြစ် မှတ်ရန်</Text>
                </Pressable> : null}
              </View>
            </View>;
          })}
        </>}
    </ScrollView>
    <Modal visible={action !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!busy) setAction(null); }}>
      <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>{action === 'copy' ? 'တစ်နေ့စာအစီအစဉ် ကူးရန်' : action ? `${mealLabel(action)}ကို စားပြီးအဖြစ် မှတ်ရန်` : 'စားသောက်အစီအစဉ်'}</Text>
        {action === 'copy' ? <>
          <Text style={styles.label}>ကူးယူမည့် မူလရက်</Text><DiaryDateField value={source} onChange={setSource} disabled={busy} />
          <Text style={styles.label}>ကူးထည့်မည့်ရက်</Text><DiaryDateField value={destination} onChange={setDestination} disabled={busy} />
        </> : <><Text style={styles.label}>စားသုံးသည့်ရက်</Text><DiaryDateField value={eatenDate} onChange={setEatenDate} disabled={busy} /></>}
        <Pressable accessibilityRole="button" disabled={busy} style={[styles.button, busy && styles.disabled]} onPress={confirmAction}><Text style={styles.buttonText}>{busy ? foodText.saving : action === 'copy' ? 'အစီအစဉ်ကူးရန်' : 'စားသုံးမှု မှတ်တမ်းတင်ရန်'}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} style={styles.option} onPress={() => setAction(null)}><Text style={styles.body}>{foodText.cancel}</Text></Pressable>
        {actionError ? <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text> : null}
      </ScrollView></SafeAreaView>
    </Modal>
  </SafeAreaView>;
}

const planningColor = '#2563A0';
const ui = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  toolbarButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  actionText: { fontSize: 16, fontWeight: '600', color: planningColor, flexShrink: 1 },
  forecast: { gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderColor: planningColor },
  plannedTotal: { color: planningColor },
  targetAction: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  mealCard: { gap: 12, padding: 16, borderRadius: 8, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: '#D6E3F2', borderLeftWidth: 4 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  eatenAction: { fontSize: 16, fontWeight: '600', color: theme.colors.accent, flexShrink: 1 },
});
