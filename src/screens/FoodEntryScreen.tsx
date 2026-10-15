import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { foodStyles } from '@/components/foodUi';
import { localCalendarDate, meals, validateCalendarDate, type Meal } from '@/domain/diary';
import { foodText } from '@/i18n/foodMy';
import { FoodCatalogScreen } from '@/screens/FoodCatalogScreen';
import { FoodEditorScreen } from '@/screens/FoodEditorScreen';

export function FoodEntryScreen({ planning = false, custom = false }: { planning?: boolean; custom?: boolean }) {
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const router = useRouter();
  const date = typeof params.date === 'string' ? params.date : localCalendarDate();
  const meal = meals.includes(params.meal as Meal) ? params.meal as Meal : 'snacks';
  try { validateCalendarDate(date); }
  catch { return <View style={foodStyles.status}><Text style={foodStyles.error}>{foodText.invalidDate}</Text></View>; }
  const edit = (foodId: string) => router.replace({ pathname: planning ? '/plans/edit' : '/diary/edit', params: { foodId, date, meal } });
  return custom ? <FoodEditorScreen onCreated={edit} /> : <FoodCatalogScreen
    onAddCustom={() => router.push({ pathname: planning ? '/plans/custom-food' : '/diary/custom-food', params: { date, meal } })}
    onSelect={(food) => edit(food.id)} />;
}
