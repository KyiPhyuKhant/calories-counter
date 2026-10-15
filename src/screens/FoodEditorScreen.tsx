import { useEffect, useRef, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Save, Trash2, X } from 'lucide-react-native';
import { ActivityIndicator, Alert, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SimpleFoodFields } from '@/components/SimpleFoodFields';
import { AppButton } from '@/components/ui/AppButton';
import { foodStyles as styles } from '@/components/foodUi';
import { useRepositories } from '@/data/DatabaseProvider';
import { validateFood, type Food } from '@/domain/food';
import { displayFoodName, foodErrorMessage, foodText, foodValidationErrors } from '@/i18n/foodMy';
import { goBack } from '@/navigation/navigation';
import { createSimpleFoodForm, simpleFoodInput, type SimpleFoodForm } from '@/screens/simpleFoodForm';
import { theme } from '@/theme/theme';

export function FoodEditorScreen({ onCreated }: { onCreated?: (id: string) => void } = {}) {
  const params = useLocalSearchParams<{ id?: string | string[]; copyId?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const copyId = Array.isArray(params.copyId) ? params.copyId[0] : params.copyId;
  const loadId = id ?? copyId;
  const { foods } = useRepositories();
  const router = useRouter();
  const stackedActions = useWindowDimensions().fontScale > 1.3;
  const [original, setOriginal] = useState<Food>();
  const [form, setForm] = useState<SimpleFoodForm>(createSimpleFoodForm);
  const [loading, setLoading] = useState(Boolean(loadId));
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [action, setAction] = useState<'save' | 'delete' | null>(null);
  const busy = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loadId) return;
    let active = true;
    foods.get(loadId).then((food) => {
      if (!active) return;
      if (!food || (id && food.source !== 'custom')) { setLoadError(foodText.loadError); setLoading(false); return; }
      setOriginal(food); setForm(createSimpleFoodForm(food)); setLoading(false);
    }).catch(() => { if (active) { setLoadError(foodText.loadError); setLoading(false); } });
    return () => { active = false; };
  }, [foods, id, loadId, attempt]);

  const input = simpleFoodInput(form, original);
  const errors = foodValidationErrors(validateFood(input));
  async function save() {
    if (busy.current) return;
    setSubmitted(true);
    if (Object.keys(errors).length) { setError(foodText.checkFields); return; }
    busy.current = true; setAction('save'); setError('');
    try {
      if (id) { await foods.updateCustom(id, input); goBack(router); }
      else {
        const newId = await foods.createCustom(input);
        if (onCreated) onCreated(newId);
        else router.replace({ pathname: '/foods/[id]', params: { id: newId } });
      }
    } catch (failure) { setError(foodErrorMessage(failure, foodText.saveError)); }
    finally { busy.current = false; setAction(null); }
  }
  async function remove() {
    if (!id || busy.current) return;
    busy.current = true; setAction('delete'); setError('');
    try { await foods.remove(id); router.dismissTo('/foods'); }
    catch { setError(foodText.deleteError); }
    finally { busy.current = false; setAction(null); }
  }
  if (loading) return <View style={styles.status}><ActivityIndicator accessibilityLabel={foodText.loading} color={theme.colors.accent} /></View>;
  if (loadError) return <View style={styles.status}><Text accessibilityRole="alert" style={styles.error}>{loadError}</Text>
    <AppButton title={foodText.retry} onPress={() => { setLoading(true); setLoadError(''); setAttempt((value) => value + 1); }} />
    <AppButton title={foodText.cancel} variant="ghost" onPress={() => goBack(router)} />
  </View>;

  return <SafeAreaView edges={['left', 'right']} style={styles.screen}>
    <Stack.Screen options={{ title: id ? foodText.edit : foodText.add }} />
    <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <SimpleFoodFields form={form} onChange={(changes) => { setForm((previous) => ({ ...previous, ...changes })); setError(''); }} errors={submitted ? errors : {}} disabled={action !== null} />
      <View style={{ flexDirection: stackedActions ? 'column' : 'row', flexWrap: 'wrap', gap: 8 }}>
        <AppButton title={foodText.save} icon={Save} loading={action === 'save'} disabled={action !== null} onPress={save} style={{ flex: stackedActions ? undefined : 1, minWidth: 120 }} />
        <AppButton title={foodText.cancel} icon={X} variant="secondary" disabled={action !== null} onPress={() => goBack(router)} style={{ flex: stackedActions ? undefined : 1, minWidth: 120 }} />
      </View>
      {id && original?.source === 'custom' ? <AppButton title={foodText.remove} icon={Trash2} variant="danger" loading={action === 'delete'} disabled={action !== null} onPress={() => Alert.alert(
        foodText.deleteTitle, `${displayFoodName(original)}\n${foodText.deleteHint}`, [
          { text: foodText.cancel, style: 'cancel' }, { text: foodText.remove, style: 'destructive', onPress: remove },
        ])} /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}
