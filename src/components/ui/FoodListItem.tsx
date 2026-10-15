import { ChevronRight, Plus, Utensils } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { foodSourceLabel } from '@/components/foodUi';
import { hasKnownCalories, type Food } from '@/domain/food';
import { foodImage } from '@/data/foodImages';
import { theme } from '@/theme/theme';

export function FoodListItem({ food, onPress, selecting = false, image, disabled = false }: {
  food: Food; onPress: () => void; selecting?: boolean; image?: ImageSourcePropType; disabled?: boolean;
}) {
  const known = hasKnownCalories(food);
  const Icon = selecting && known ? Plus : ChevronRight;
  const thumbnail = image ?? foodImage(food.image);
  const energy = known ? `${Number(food.calories!.toFixed(1))} kcal / ${food.serving_amount} ${food.serving_unit}` : 'Calories unavailable';
  return <Pressable accessibilityRole="button" accessibilityLabel={`${selecting && known ? 'Select' : 'View'} ${food.name}${food.native_name ? `, ${food.native_name}` : ''}, ${energy}, ${foodSourceLabel(food)}`}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}>
    <View style={styles.thumbnail}>{thumbnail ? <Image source={thumbnail} accessible={false} style={styles.image} /> : <Utensils size={24} color={theme.colors.accent} />}</View>
    <View style={styles.copy}>
      <Text style={styles.name}>{food.name}</Text>
      {food.native_name ? <Text style={styles.detail}>{food.native_name}</Text> : null}
      <Text style={styles.detail}>{energy}</Text>
      <Text style={styles.source}>{foodSourceLabel(food)}</Text>
    </View>
    <Icon size={20} color={theme.colors.accent} />
  </Pressable>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 76, borderBottomWidth: 1, borderColor: theme.colors.border },
  thumbnail: { width: 48, height: 48, borderRadius: theme.radius.control, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentSurface },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...theme.typography.label, color: theme.colors.text },
  detail: { ...theme.typography.caption, color: theme.colors.secondaryText },
  source: { ...theme.typography.caption, color: theme.colors.secondaryText },
  pressed: { backgroundColor: theme.colors.surfaceMuted },
  disabled: { opacity: 0.5 },
});
