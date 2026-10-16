import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { caloriesLabel, diaryStyles, mealLabel } from '@/components/diaryUi';
import { AppHeader } from '@/components/ui/AppHeader';
import { BrandLogo } from '@/components/BrandLogo';
import { AppCard } from '@/components/ui/AppCard';
import { CalorieProgressRing } from '@/components/ui/CalorieProgressRing';
import { DateNavigator } from '@/components/ui/DateNavigator';
import { foodStyles } from '@/components/foodUi';
import { useRepositories } from '@/data/DatabaseProvider';
import type { Repositories } from '@/data/repositories';
import { localCalendarDate, meals } from '@/domain/diary';
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
        if (active && current === request) setError('တစ်နေ့တာအကျဉ်းချုပ်ကို ဖတ်ယူ၍မရပါ။ ပြန်လည်ကြိုးစားပါ။');
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
      <AppHeader title="ပင်မ" subtitle="နေ့စဉ်ကယ်လိုရီ" leading={<BrandLogo size={88} />} />
      <DateNavigator value={date} onChange={selectDate} />
      {date !== localCalendarDate() ? <Pressable accessibilityRole="button" onPress={() => selectDate(localCalendarDate())} style={styles.today}><Text style={styles.link}>ယနေ့</Text></Pressable> : null}
      {error ? <View style={foodStyles.field}>
        <Text accessibilityRole="alert" style={foodStyles.error}>{error}</Text>
        <Pressable accessibilityRole="button" style={foodStyles.button} onPress={() => setRetry((current) => current + 1)}><Text style={foodStyles.buttonText}>ပြန်လည်ကြိုးစားရန်</Text></Pressable>
      </View> : !day ? <ActivityIndicator accessibilityLabel="အကျဉ်းချုပ်ဖတ်ယူနေသည်" color={theme.colors.accent} /> : <>
        <AppCard style={styles.summary}>
          <Text style={foodStyles.label}>{progress ? over ? 'ရည်မှန်းချက်ထက် ကျော်လွန်နေသည်' : progress.state === 'reached' ? 'ရည်မှန်းချက်ပြည့်ပါပြီ' : 'ကျန်ရှိကယ်လိုရီ' : 'စားသုံးပြီး ကယ်လိုရီ'}</Text>
          <Text accessibilityLiveRegion="polite" style={[styles.balance, over && styles.warning]}>
            {progress ? progress.state === 'reached' ? '0 kcal ကျန်ရှိသည်' : balanceLabel(over ? progress.over : progress.remaining) : caloriesLabel(day.totals.total)}
          </Text>
          {progress ? <>
            <CalorieProgressRing progress={progress.fraction} value={caloriesLabel(progress.consumed)} caption={`${caloriesLabel(progress.target)} မှ`}
              overTarget={over} accessibilityLabel={`တစ်နေ့တာ ကယ်လိုရီတိုးတက်မှု${over ? `၊ ရည်မှန်းချက်ထက် ${balanceLabel(progress.over)} ကျော်လွန်နေသည်` : ''}`} />
            <View style={styles.metrics}>
              <View style={styles.metric}><Text style={foodStyles.detail}>စားသုံးပြီး</Text><Text style={foodStyles.label}>{caloriesLabel(progress.consumed)}</Text></View>
              <View style={styles.metric}><Text style={foodStyles.detail}>သတ်မှတ်ကယ်လိုရီ</Text><Text style={foodStyles.label}>{caloriesLabel(progress.target)}</Text></View>
            </View>
            <Text style={foodStyles.detail}>လက်ရှိကိုယ်ရေးအချက်အလက်မှ ခန့်မှန်းထားသော ကယ်လိုရီရည်မှန်းချက် ဖြစ်သည်။</Text>
          </> : <>
            <Text style={foodStyles.body}>သတ်မှတ်ကယ်လိုရီ မသတ်မှတ်ရသေးပါ။</Text>
            <Pressable accessibilityRole="button" style={foodStyles.button} onPress={() => router.push('/goal-settings')}><Text style={foodStyles.buttonText}>ကယ်လိုရီရည်မှန်းချက် သတ်မှတ်ရန်</Text></Pressable>
          </>}
        </AppCard>
      </>}
      {day && !error ? <>
        <Text accessibilityRole="header" style={foodStyles.label}>စားသုံးပြီးသော အစားအစာများ</Text>
        {meals.map((meal) => {
          const entries = day.entries.filter((entry) => entry.meal === meal);
          return <View style={styles.mealRow} key={meal}>
            <Text style={[foodStyles.body, diaryStyles.grow]}>{mealLabel(meal)}</Text>
            <Text style={foodStyles.detail}>{entries.length ? caloriesLabel(day.totals.byMeal[meal]) : 'မှတ်တမ်း မရှိသေးပါ'}</Text>
          </View>;
        })}
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  today: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 12 },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 },
  link: { ...theme.typography.button, color: theme.colors.accent, flexShrink: 1 },
  summary: { gap: 12 },
  balance: { ...theme.typography.metric, color: theme.colors.accent },
  warning: { color: theme.colors.warning },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.medium },
  metric: { flexGrow: 1, flexBasis: 120, gap: 4 },
});
