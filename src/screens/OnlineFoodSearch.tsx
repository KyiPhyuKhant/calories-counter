import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react-native';
import { ActivityIndicator, FlatList, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { foodStyles as styles } from '@/components/foodUi';
import { useRepositories } from '@/data/DatabaseProvider';
import { FoodProviderError, type FoodProvider, type ProviderFood } from '@/data/foodProvider';
import { createUsdaFoodProvider } from '@/data/usdaFoodProvider';
import type { Food } from '@/domain/food';
import { theme } from '@/theme/theme';

function configuredProvider(): FoodProvider | null {
  const baseUrl = process.env.EXPO_PUBLIC_FOOD_API_URL;
  if (!baseUrl) return null;
  try { return createUsdaFoodProvider({ baseUrl, allowInsecureHttp: __DEV__ }); } catch { return null; }
}
const defaultProvider = configuredProvider();
const currentTime = () => Date.now();

export function OnlineFoodSearch({ onSelect, provider = defaultProvider }: { onSelect: (food: Food) => void; provider?: FoodProvider | null }) {
  const { foods } = useRepositories();
  const [query, setQuery] = useState(''); const [items, setItems] = useState<ProviderFood[]>([]);
  const [searched, setSearched] = useState(false); const [loading, setLoading] = useState(false);
  const [error, setError] = useState(''); const [detailError, setDetailError] = useState('');
  const [open, setOpen] = useState(false); const [detail, setDetail] = useState<ProviderFood | null>(null);
  const [detailLoading, setDetailLoading] = useState(false); const [saving, setSaving] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const searchRequest = useRef<AbortController | null>(null); const detailRequest = useRef<AbortController | null>(null);
  const active = useRef(true); const generation = useRef(0);
  useEffect(() => { active.current = true; return () => { active.current = false; searchRequest.current?.abort(); detailRequest.current?.abort(); }; }, []);

  function failureMessage(failure: unknown) {
    if (failure instanceof FoodProviderError) {
      if (failure.code === 'rate-limit') setRetryAt(currentTime() + (failure.retryAfterSeconds ?? 3600) * 1000);
      return failure.message;
    }
    return 'Could not load USDA foods. Please try again.';
  }
  async function search() {
    if (!provider || !query.trim()) return;
    if (currentTime() < retryAt) { setError(`Request limit reached. Retry in ${Math.ceil((retryAt - currentTime()) / 1000)} seconds.`); return; }
    searchRequest.current?.abort(); const controller = new AbortController(); searchRequest.current = controller;
    const request = ++generation.current;
    setLoading(true); setError(''); setItems([]); setSearched(true);
    try { const result = await provider.search(query, { signal: controller.signal }); if (active.current && request === generation.current) setItems(result); }
    catch (failure) { if (active.current && request === generation.current && !controller.signal.aborted) setError(failureMessage(failure)); }
    finally { if (active.current && request === generation.current) setLoading(false); }
  }
  async function inspect(item: ProviderFood) {
    if (!provider) return;
    if (currentTime() < retryAt) { setError('Request limit reached. Please wait before loading another food.'); return; }
    detailRequest.current?.abort(); const controller = new AbortController(); detailRequest.current = controller;
    setOpen(true); setDetail(null); setDetailLoading(true); setDetailError('');
    try {
      const food = await provider.get(item.externalId, { signal: controller.signal });
      if (!food) throw new Error('Food no longer available.');
      if (active.current && !controller.signal.aborted) setDetail(food);
    } catch (failure) { if (active.current && !controller.signal.aborted) setDetailError(failureMessage(failure)); }
    finally { if (active.current && !controller.signal.aborted) setDetailLoading(false); }
  }
  async function select() {
    if (!detail || !provider || saving) return;
    setSaving(true); setDetailError('');
    try {
      const id = await foods.saveExternal(provider.id, detail.externalId, detail);
      const cached = await foods.get(id);
      if (!cached) throw new Error('Cache read failed.');
      if (active.current) { setOpen(false); onSelect(cached); }
    } catch { if (active.current) setDetailError('Could not save this food offline. Please try again.'); }
    finally { if (active.current) setSaving(false); }
  }
  function close() { if (!saving) { detailRequest.current?.abort(); setOpen(false); } }
  const macro = (value: number | null | undefined) => value == null ? 'Not provided' : `${Number(value.toFixed(2))} g`;

  return <View style={styles.screen}>
    <View style={{ paddingHorizontal: 24, paddingBottom: 16, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
      <Text style={styles.label}>USDA FoodData Central - Online</Text>
      <TextInput accessibilityLabel="Search USDA foods" placeholder="Search USDA foods" maxLength={120} value={query} style={styles.input}
        autoCorrect={false} returnKeyType="search" onSubmitEditing={search} onChangeText={(value) => {
          searchRequest.current?.abort(); generation.current++; setLoading(false); setSearched(false); setItems([]); setError(''); setQuery(value);
        }} />
      <Pressable accessibilityRole="button" disabled={!provider || !query.trim() || loading} style={[styles.button, (!provider || !query.trim() || loading) && styles.disabled]} onPress={search}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Search size={20} color="#FFFFFF" /><Text style={styles.buttonText}>Search USDA</Text></View>
      </Pressable>
      {!provider ? <Text style={styles.detail}>Online search not configured. Saved and custom foods remain available.</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
    <FlatList data={items} keyExtractor={(item) => item.externalId} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, maxWidth: 560, width: '100%', alignSelf: 'center' }}
      ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="Searching USDA" color={theme.colors.accent} /> : searched && !error ? <Text style={styles.body}>No results with supported calorie data.</Text> : null}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`View USDA ${item.name}`} onPress={() => inspect(item)}
        style={{ paddingVertical: 16, gap: 4, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
        <Text style={styles.label}>{item.name}</Text><Text style={styles.body}>{Number(item.calories.toFixed(1))} kcal / {item.serving_amount} g</Text>
        <Text style={styles.detail}>USDA FoodData Central - {item.dataType} - Online</Text>
      </Pressable>} />
    <Modal visible={open} presentationStyle="pageSheet" animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
        {detailLoading ? <ActivityIndicator accessibilityLabel="Loading USDA nutrition" color={theme.colors.accent} /> : detail ? <>
          <Text accessibilityRole="header" style={styles.title}>{detail.name}</Text><Text style={styles.detail}>USDA FoodData Central - {detail.dataType} - Online</Text>
          <Text style={styles.body}>Serving: {detail.serving_amount} g</Text><Text style={styles.nutrition}>{Number(detail.calories.toFixed(1))} kcal</Text>
          <Text style={styles.body}>Protein: {macro(detail.protein)}</Text><Text style={styles.body}>Carbohydrates: {macro(detail.carbohydrates)}</Text><Text style={styles.body}>Fat: {macro(detail.fat)}</Text>
          <Text style={styles.detail}>{detail.notes}</Text>
          {detail.sourceUrl ? <Pressable accessibilityRole="link" style={styles.option} onPress={() => Linking.openURL(detail.sourceUrl!).catch(() => setDetailError('Could not open the USDA source page.'))}><Text style={styles.body}>USDA source</Text></Pressable> : null}
          <Pressable accessibilityRole="button" disabled={saving} style={[styles.button, saving && styles.disabled]} onPress={select}><Text style={styles.buttonText}>{saving ? 'Saving...' : 'Select and save offline'}</Text></Pressable>
        </> : null}
        {detailError ? <Text accessibilityRole="alert" style={styles.error}>{detailError}</Text> : null}
        <Pressable accessibilityRole="button" disabled={saving} style={styles.option} onPress={close}><Text style={styles.body}>Close</Text></Pressable>
      </ScrollView></SafeAreaView>
    </Modal>
  </View>;
}
