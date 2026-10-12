import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { foodSourceLabel, foodStyles as styles } from '@/components/foodUi';
import { useRepositories } from '@/data/DatabaseProvider';
import type { Food } from '@/domain/food';
import { theme } from '@/theme/theme';

export function FoodCatalogScreen({ onSelect }: { onSelect?: (food: Food) => void } = {}) {
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

  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.screen}>
    <View style={local.header}>
      <TextInput accessibilityLabel="Search foods by name" placeholder="Search foods" value={query} maxLength={120}
        onChangeText={(value) => { setLoading(true); setQuery(value); }} autoCorrect={false}
        returnKeyType="search" clearButtonMode="while-editing" style={styles.input} />
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.push('/foods/edit')}>
        <Text style={styles.buttonText}>Add custom food</Text>
      </Pressable>
      <Text style={styles.detail}>Offline catalog. Demo foods contain invented, unverified values.</Text>
    </View>
    <FlatList data={loading ? [] : items} keyExtractor={(food) => food.id} keyboardShouldPersistTaps="handled"
      contentContainerStyle={local.list}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${onSelect ? 'Select' : 'View'} ${item.name}`}
        style={local.row} onPress={() => onSelect ? onSelect(item) : router.push({ pathname: '/foods/[id]', params: { id: item.id } })}>
        <Text style={styles.label}>{item.name}</Text>
        <Text style={styles.body}>{Number(item.calories.toFixed(1))} kcal / {item.serving_amount} {item.serving_unit}</Text>
        <Text style={styles.detail}>{foodSourceLabel(item)}</Text>
      </Pressable>}
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
  row: { paddingVertical: 16, gap: 4, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  footer: { paddingVertical: 20, gap: 16 },
});
