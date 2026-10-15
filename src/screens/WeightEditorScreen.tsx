import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DiaryDateField } from '@/components/diaryUi';
import { FoodField, foodStyles as styles } from '@/components/foodUi';
import { useRepositories } from '@/data/DatabaseProvider';
import { localCalendarDate, validateCalendarDate } from '@/domain/diary';
import { validateWeight } from '@/domain/history';
import { theme } from '@/theme/theme';
import { parseFormNumber } from '@/domain/formNumber';

export function WeightEditorScreen() {
  const params = useLocalSearchParams<{ id?: string; date?: string; period?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const { weights } = useRepositories(); const router = useRouter();
  const [date, setDate] = useState(localCalendarDate);
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      const selectedDate = typeof params.date === 'string' ? params.date : localCalendarDate();
      validateCalendarDate(selectedDate);
      const entry = id ? await weights.get(id) : null;
      if (id && !entry) throw new Error('Weight entry not found.');
      if (active) { setDate(entry?.measured_date ?? selectedDate); setWeight(entry ? String(entry.weight_kg) : ''); setLoading(false); }
    }
    void load().catch((failure) => { if (active) { setLoadError(failure instanceof Error ? failure.message : 'Could not load weight entry.'); setLoading(false); } });
    return () => { active = false; };
  }, [weights, id, params.date, retry]);
  const numeric = parseFormNumber(weight);
  let validation = '';
  try { validateWeight(date, numeric); } catch (failure) { validation = failure instanceof Error ? failure.message : 'Check this measurement.'; }
  async function save() {
    if (savingRef.current) return;
    if (validation) { setError(validation); return; }
    savingRef.current = true; setSaving(true); setError('');
    try {
      if (id) await weights.update(id, date, numeric); else await weights.create(date, numeric);
      router.dismissTo({ pathname: '/history', params: { date, period: params.period === 'month' ? 'month' : 'week', view: 'weight' } });
    } catch { setError('Could not save this measurement. Your edits are still here; please try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  if (loading) return <View style={styles.status}><ActivityIndicator accessibilityLabel="Loading weight entry" color={theme.colors.accent} /></View>;
  if (loadError) return <View style={styles.status}><Text accessibilityRole="alert" style={styles.error}>{loadError}</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => { setLoadError(''); setLoading(true); setRetry((value) => value + 1); }}><Text style={styles.buttonText}>Try again</Text></Pressable></View>;
  return <SafeAreaView edges={['left', 'right']} style={styles.screen}>
      <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text accessibilityRole="header" style={styles.title}>{id ? 'Edit measurement' : 'Record weight'}</Text>
        <Text style={styles.label}>Measurement date</Text><DiaryDateField value={date} onChange={setDate} disabled={saving} />
        <FoodField label="Weight (kg)" numeric value={weight} onChange={(value) => { setWeight(value); setError(''); }} disabled={saving} />
        <Text style={styles.detail}>Recorded weight; profile weight unchanged.</Text>
        <Pressable accessibilityRole="button" style={[styles.button, saving && styles.disabled]} disabled={saving} onPress={save}><Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save measurement'}</Text></Pressable>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
  </SafeAreaView>;
}
