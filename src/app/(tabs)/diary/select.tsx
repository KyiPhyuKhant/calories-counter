import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { foodStyles } from '@/components/foodUi';
import { localCalendarDate, meals, validateCalendarDate, type Meal } from '@/domain/diary';
import { FoodCatalogScreen } from '@/screens/FoodCatalogScreen';

export default function DiaryFoodSelectionRoute() {
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const router = useRouter();
  const date = typeof params.date === 'string' ? params.date : localCalendarDate();
  const meal = meals.includes(params.meal as Meal) ? params.meal as Meal : 'snacks';
  try { validateCalendarDate(date); }
  catch { return <View style={foodStyles.status}><Text style={foodStyles.error}>Invalid diary date.</Text></View>; }
  return <FoodCatalogScreen onAddCustom={() => router.push({ pathname: '/diary/custom-food', params: { date, meal } })}
    onSelect={(food) => router.replace({ pathname: '/diary/edit', params: { foodId: food.id, date, meal } })} />;
}
