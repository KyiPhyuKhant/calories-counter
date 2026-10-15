import { useRouter } from 'expo-router';
import { ArrowLeft, House } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { goBack, goHome } from '@/navigation/navigation';
import { theme } from '@/theme/theme';

export function NavigationButton({ destination }: { destination: 'back' | 'home' }) {
  const router = useRouter();
  const isBack = destination === 'back';
  const Icon = isBack ? ArrowLeft : House;

  return <Pressable accessibilityRole="button" accessibilityLabel={isBack ? 'နောက်သို့ ပြန်ရန်' : 'ပင်မသို့ ပြန်ရန်'}
    onPress={() => isBack ? goBack(router) : goHome(router)}
    style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
    <Icon size={20} color={theme.colors.accent} />
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
