import { useRouter } from 'expo-router';
import { ArrowLeft, House } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import { goBack, goHome } from '@/navigation/navigation';
import { theme } from '@/theme/theme';

export function NavigationButton({ destination }: { destination: 'back' | 'home' }) {
  const router = useRouter();
  const isBack = destination === 'back';
  const Icon = isBack ? ArrowLeft : House;
  const label = isBack ? 'Back' : 'Home';

  return <Pressable accessibilityRole="button" accessibilityLabel={isBack ? 'Go back' : 'Go to Home'}
    onPress={() => isBack ? goBack(router) : goHome(router)}
    style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
    <Icon size={20} color={theme.colors.accent} />
    <Text maxFontSizeMultiplier={1.3} style={styles.label}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  label: { fontSize: 16, color: theme.colors.accent, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
