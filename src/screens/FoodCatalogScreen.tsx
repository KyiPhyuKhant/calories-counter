import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Search } from 'lucide-react-native';

import { foodStyles as styles } from '@/components/foodUi';
import { useRepositories } from '@/data/DatabaseProvider';
import type { Food } from '@/domain/food';
import { theme } from '@/theme/theme';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { FoodListItem } from '@/components/ui/FoodListItem';

export function FoodCatalogScreen({ onSelect, onAddCustom }: { onSelect?: (food: Food) => void; onAddCustom?: () => void } = {}) {
  const { foods } = useRepositories();
  const router = useRouter();
  const [query, setQuery] = useState('');
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
      foods.search(query).then((result) => {
        if (request !== generation.current) return;
        setItems(result); setHasMore(result.length === 50); setLoading(false);
      }).catch(() => {
        if (request !== generation.current) return;
        setItems([]); setHasMore(false); setError('Could not load foods. Please try again.'); setLoading(false);
      });
    }, 200);
    return () => { clearTimeout(timer); generation.current++; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Explicit retry must restart the focus query.
  }, [foods, query, retry]));

  async function loadMore() {
    if (loading || moreLoading) return;
    const request = generation.current;
    setMoreLoading(true); setError('');
    try {
      const result = await foods.search(query, 50, items.length);
      if (request === generation.current) { setItems((previous) => [...previous, ...result]); setHasMore(result.length === 50); }
    } catch { if (request === generation.current) setError('Could not load the next page. Please try again.'); }
    finally { if (request === generation.current) setMoreLoading(false); }
  }

  return <SafeAreaView edges={['left', 'right']} style={styles.screen}>
    <View style={local.header}>
      <AppInput label="Search foods by name" hideLabel variant="search" icon={Search} placeholder="Search foods" value={query} maxLength={120}
        onChangeText={(value) => { setLoading(true); setQuery(value); }} autoCorrect={false}
        returnKeyType="search" clearButtonMode="while-editing" />
      <AppButton title="Add custom food" icon={Plus} onPress={onAddCustom ?? (() => router.push('/foods/edit'))} />
      <Text style={styles.detail}>Offline catalog. Demo foods contain invented, unverified values.</Text>
    </View>
    <FlatList data={loading ? [] : items} keyExtractor={(food) => food.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets
      contentContainerStyle={local.list}
      renderItem={({ item }) => <FoodListItem food={item} selecting={Boolean(onSelect)}
        onPress={() => onSelect ? onSelect(item) : router.push({ pathname: '/foods/[id]', params: { id: item.id } })} />}
      ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="Searching foods" color={theme.colors.accent} />
        : !error ? <Text style={styles.body}>No foods found.</Text> : null}
      ListFooterComponent={<View style={local.footer}>
        {error ? <><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => items.length ? loadMore() : setRetry((value) => value + 1)}><Text style={styles.buttonText}>Try again</Text></Pressable></> : null}
        {hasMore && !loading && !error ? <Pressable accessibilityRole="button" disabled={moreLoading} style={styles.button} onPress={loadMore}>
          <Text style={styles.buttonText}>{moreLoading ? 'Loading...' : 'Load more'}</Text></Pressable> : null}
      </View>} />
  </SafeAreaView>;
}

const local = StyleSheet.create({
  header: { padding: 24, gap: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  list: { paddingHorizontal: 24, paddingBottom: 24, width: '100%', maxWidth: 560, alignSelf: 'center' },
  footer: { paddingVertical: 20, gap: 16 },
});
