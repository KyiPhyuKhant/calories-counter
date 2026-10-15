import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Search, X } from 'lucide-react-native';

import { foodStyles as styles } from '@/components/foodUi';
import { useRepositories } from '@/data/DatabaseProvider';
import { cuisineLabels, hasKnownCalories, type Cuisine, type Food } from '@/domain/food';
import { CuisinePicker } from '@/components/CuisinePicker';
import { theme } from '@/theme/theme';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { FoodListItem } from '@/components/ui/FoodListItem';
import { foodText } from '@/i18n/foodMy';

export function FoodCatalogScreen({ onSelect, onAddCustom }: { onSelect?: (food: Food) => void; onAddCustom?: () => void } = {}) {
  const { foods } = useRepositories();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [cuisine, setCuisine] = useState<Cuisine | null>(null);
  const [items, setItems] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);

  useFocusEffect(useCallback(() => {
    const request = ++generation.current;
    const timer = setTimeout(() => {
      setLoading(true); setError(''); setMoreLoading(false);
      foods.search(query, 50, 0, cuisine).then((result) => {
        if (request !== generation.current) return;
        setItems(result); setHasMore(result.length === 50); setLoading(false);
      }).catch(() => {
        if (request !== generation.current) return;
        setItems([]); setHasMore(false); setError(foodText.loadError); setLoading(false);
      });
    }, 200);
    return () => { clearTimeout(timer); generation.current++; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Explicit retry must restart the focus query.
  }, [foods, query, cuisine, retry]));

  async function loadMore() {
    if (loading || moreLoading) return;
    const request = generation.current;
    setMoreLoading(true); setError('');
    try {
      const result = await foods.search(query, 50, items.length, cuisine);
      if (request === generation.current) { setItems((previous) => [...previous, ...result]); setHasMore(result.length === 50); }
    } catch { if (request === generation.current) setError('နောက်ထပ်အစားအစာများကို ဖတ်ယူ၍မရပါ။ ပြန်လည်ကြိုးစားပါ။'); }
    finally { if (request === generation.current) setMoreLoading(false); }
  }

  return <SafeAreaView edges={['left', 'right']} style={styles.screen}>
    <View style={local.header}>
      <AppInput label={foodText.search} hideLabel variant="search" icon={Search} placeholder={foodText.search} value={query} maxLength={120}
        onChangeText={(value) => { if (value !== query) { generation.current++; setLoading(true); setQuery(value); } }} autoCorrect={false}
        returnKeyType="search" clearButtonMode="while-editing" />
      <CuisinePicker value={cuisine} onChange={(value) => {
        if (value === cuisine) return;
        generation.current++; setLoading(true); setItems([]); setHasMore(false); setError(''); setCuisine(value);
      }} />
      <AppButton title={foodText.add} icon={Plus} onPress={onAddCustom ?? (() => router.push('/foods/edit'))} />
    </View>
    <FlatList data={loading ? [] : items} keyExtractor={(food) => food.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets
      contentContainerStyle={local.list}
      renderItem={({ item }) => <FoodListItem food={item} selecting={Boolean(onSelect)}
        onPress={() => onSelect && hasKnownCalories(item) ? onSelect(item) : router.push({ pathname: '/foods/[id]', params: { id: item.id } })} />}
      ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="အစားအစာရှာနေသည်" color={theme.colors.accent} />
        : !error ? <View style={styles.field}>
          <Text style={styles.body}>{cuisine === null ? foodText.empty : `${cuisineLabels[cuisine]} အစားအစာမတွေ့ပါ။`}</Text>
          {cuisine !== null ? <AppButton title={foodText.clearFilter} variant="secondary" icon={X} onPress={() => {
            generation.current++; setLoading(true); setCuisine(null);
          }} /> : null}
        </View> : null}
      ListFooterComponent={<View style={local.footer}>
        {error ? <><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => items.length ? loadMore() : setRetry((value) => value + 1)}><Text style={styles.buttonText}>{foodText.retry}</Text></Pressable></> : null}
        {hasMore && !loading && !error ? <Pressable accessibilityRole="button" disabled={moreLoading} style={styles.button} onPress={loadMore}>
          <Text style={styles.buttonText}>{moreLoading ? foodText.loading : 'ထပ်မံကြည့်ရန်'}</Text></Pressable> : null}
      </View>} />
  </SafeAreaView>;
}

const local = StyleSheet.create({
  header: { padding: 16, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  footer: { paddingVertical: 20, gap: 16 },
});
