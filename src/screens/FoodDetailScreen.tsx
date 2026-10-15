import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodField, foodSourceLabel, foodStyles as styles } from '@/components/foodUi';
import { useRepositories } from '@/data/DatabaseProvider';
import { calculateServing, type Food } from '@/domain/food';
import { theme } from '@/theme/theme';
import { parseFormNumber } from '@/domain/formNumber';

export function FoodDetailScreen() {
  const { id: param } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(param) ? param[0] : param;
  const { foods } = useRepositories();
  const router = useRouter();
  const [food, setFood] = useState<Food | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    foods.get(id).then((result) => {
      if (!active) return;
      setFood(result); setLoading(false); setError(result ? '' : 'Food not found.');
      if (result) setAmount(result.serving_amount.toString());
    }).catch(() => { if (active) { setError('Could not load this food.'); setLoading(false); } });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Explicit retry must restart the focus query.
  }, [foods, id, attempt]));

  async function remove() {
    if (!food || deleting) return;
    setDeleting(true);
    try { await foods.remove(food.id); router.dismissTo('/foods'); }
    catch { setError('Could not delete this food. Please try again.'); setDeleting(false); }
  }
  if (loading) return <View style={styles.status}><ActivityIndicator accessibilityLabel="Loading food details" color={theme.colors.accent} /></View>;
  if (!food) return <View style={styles.status}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => { setLoading(true); setAttempt((value) => value + 1); }}><Text style={styles.buttonText}>Try again</Text></Pressable></View>;
  let nutrition: ReturnType<typeof calculateServing> | null = null;
  let amountError = '';
  try {
    nutrition = calculateServing(food, parseFormNumber(amount));
  } catch { amountError = 'Enter a positive amount up to 100000 in the declared unit.'; }
  const display = (value: number | null) => value === null ? 'Not provided' : `${Number(value.toFixed(1))} g`;

  return <SafeAreaView edges={['left', 'right']} style={styles.screen}>
    <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Text accessibilityRole="header" style={styles.title}>{food.name}</Text>
      <Text style={styles.detail}>{foodSourceLabel(food)}</Text>
      {food.source === 'bundled' ? <Text style={styles.error}>Invented development values. Not verified nutritional data.</Text> : null}
      {food.external_id ? <Text style={styles.detail}>Provider ID: {food.external_id}</Text> : null}
      <Text style={styles.body}>Declared serving: {food.serving_amount} {food.serving_unit}, {Number(food.calories.toFixed(1))} kcal</Text>
      <FoodField label={`Amount (${food.serving_unit})`} value={amount} numeric onChange={setAmount} error={amountError} />
      {nutrition ? <View style={styles.field}>
        <Text style={styles.nutrition}>{Number(nutrition.calories.toFixed(1))} kcal</Text>
        <Text style={styles.body}>Protein: {display(nutrition.protein)}</Text>
        <Text style={styles.body}>Carbohydrates: {display(nutrition.carbohydrates)}</Text>
        <Text style={styles.body}>Fat: {display(nutrition.fat)}</Text>
      </View> : null}
      {food.notes ? <View style={styles.field}><Text style={styles.label}>Notes</Text><Text style={styles.body}>{food.notes}</Text></View> : null}
      {food.source === 'custom' ? <>
        <Pressable accessibilityRole="button" disabled={deleting} style={styles.button}
          onPress={() => router.push({ pathname: '/foods/edit', params: { id: food.id } })}><Text style={styles.buttonText}>Edit custom food</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={deleting} style={[styles.button, styles.destructive]}
          onPress={() => Alert.alert('Delete custom food?', 'Existing diary snapshots will be kept.', [
            { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: remove },
          ])}><Text style={styles.buttonText}>{deleting ? 'Deleting...' : 'Delete custom food'}</Text></Pressable>
      </> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}
