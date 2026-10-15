import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { foodStyles } from '@/components/foodUi';
import { localCalendarDate, meals, validateCalendarDate, type Meal } from '@/domain/diary';
import { FoodEditorScreen } from '@/screens/FoodEditorScreen';

export function CustomFoodForEntryScreen({ planning = false }: { planning?: boolean }) {
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const router = useRouter();
  const date = typeof params.date === 'string' ? params.date : localCalendarDate();
  const meal = meals.includes(params.meal as Meal) ? params.meal as Meal : 'snacks';
  try { validateCalendarDate(date); }
  catch { return <View style={foodStyles.status}><Text style={foodStyles.error}>ရက်စွဲ မမှန်ပါ။</Text></View>; }
  return <FoodEditorScreen onCreated={(foodId) => router.replace({ pathname: planning ? '/plans/edit' : '/diary/edit', params: { foodId, date, meal } })} />;
}
