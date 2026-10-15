import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodField, foodSourceLabel, foodStyles as styles, isDevelopmentFood } from '@/components/foodUi';
import { useRepositories } from '@/data/DatabaseProvider';
import { calculateServing, type Food } from '@/domain/food';
import { theme } from '@/theme/theme';
import { parseFormNumber } from '@/domain/formNumber';
import { displayFoodName, foodAmount, foodErrorMessage, foodText } from '@/i18n/foodMy';

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
      setFood(result); setLoading(false); setError(result ? '' : 'အစားအစာမတွေ့ပါ။');
      if (result) setAmount(result.serving_amount.toString());
    }).catch(() => { if (active) { setError(foodText.loadError); setLoading(false); } });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Explicit retry must restart the focus query.
  }, [foods, id, attempt]));

  async function remove() {
    if (!food || deleting) return;
    setDeleting(true);
    try { await foods.remove(food.id); router.dismissTo('/foods'); }
    catch { setError(foodText.deleteError); setDeleting(false); }
  }
  if (loading) return <View style={styles.status}><ActivityIndicator accessibilityLabel={foodText.loading} color={theme.colors.accent} /></View>;
  if (!food) return <View style={styles.status}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => { setLoading(true); setAttempt((value) => value + 1); }}><Text style={styles.buttonText}>{foodText.retry}</Text></Pressable></View>;
  let nutrition: ReturnType<typeof calculateServing> | null = null;
  let amountError = '';
  try {
    nutrition = calculateServing(food, parseFormNumber(amount));
  } catch (failure) { amountError = foodErrorMessage(failure, 'အစားအစာပမာဏကို ပြန်စစ်ပါ။'); }
  const display = (value: number | null) => value === null ? foodText.noValue : foodAmount(value, 'g');

  return <SafeAreaView edges={['left', 'right']} style={styles.screen}>
    <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Text accessibilityRole="header" style={styles.title}>{displayFoodName(food)}</Text>
      <Text style={styles.detail}>{foodSourceLabel(food)}</Text>
      {isDevelopmentFood(food) ? <Text style={styles.error}>{foodText.demoWarning}</Text> : null}
      {food.id.startsWith('catalog:') ? <Text style={styles.detail}>ဖော်ပြထားသောပမာဏသည် နမူနာသာဖြစ်သည်။ ပါဝင်ပစ္စည်း၊ ဆီနှင့် စားသုံးပမာဏအလိုက် ကယ်လိုရီကွာနိုင်ပါသည်။</Text> : null}
      {food.nutrition_source ? <Text style={styles.detail}>အာဟာရအချက်အလက်ရင်းမြစ် — {food.nutrition_source}</Text> : null}
      <Text style={styles.body}>အခြေခံပမာဏ — {foodAmount(food.serving_amount, food.serving_unit)}</Text>
      <FoodField label={foodText.amount} value={amount} numeric onChange={setAmount} error={amountError} />
      {nutrition ? <View style={styles.field}>
        <Text style={styles.nutrition}>{nutrition.calories === null ? foodText.unavailable : `${Number(nutrition.calories.toFixed(1))} kcal`}</Text>
        {nutrition.protein !== null ? <Text style={styles.body}>ပရိုတင်း — {display(nutrition.protein)}</Text> : null}
        {nutrition.carbohydrates !== null ? <Text style={styles.body}>ကာဘိုဟိုက်ဒရိတ် — {display(nutrition.carbohydrates)}</Text> : null}
        {nutrition.fat !== null ? <Text style={styles.body}>အဆီ — {display(nutrition.fat)}</Text> : null}
      </View> : null}
      {food.calories === null ? <Text style={styles.detail}>{foodText.unknownWarning}</Text> : null}
      {food.notes && !food.notes.startsWith('Nutrition not yet verified.') && !food.notes.startsWith('Development sample:') ? <View style={styles.field}><Text style={styles.label}>မှတ်ချက်</Text><Text style={styles.body}>{food.notes}</Text></View> : null}
      {food.source !== 'custom' ? <Pressable accessibilityRole="button" style={styles.button}
        onPress={() => router.push({ pathname: '/foods/edit', params: { copyId: food.id } })}><Text style={styles.buttonText}>{foodText.createVersion}</Text></Pressable> : null}
      {food.source === 'custom' ? <>
        <Pressable accessibilityRole="button" disabled={deleting} style={styles.button}
          onPress={() => router.push({ pathname: '/foods/edit', params: { id: food.id } })}><Text style={styles.buttonText}>{foodText.edit}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={deleting} style={[styles.button, styles.destructive]}
          onPress={() => Alert.alert(foodText.deleteTitle, foodText.deleteHint, [
            { text: foodText.cancel, style: 'cancel' }, { text: foodText.remove, style: 'destructive', onPress: remove },
          ])}><Text style={styles.buttonText}>{deleting ? 'ဖျက်နေသည်…' : foodText.remove}</Text></Pressable>
      </> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}
