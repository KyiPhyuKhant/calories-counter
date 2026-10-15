import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme/theme';

export function AppHeader({ title, subtitle, leading, trailing }: { title: string; subtitle?: string; leading?: ReactNode; trailing?: ReactNode }) {
  return <View style={styles.header}>
    {leading}
    <View style={styles.copy}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
    {trailing}
  </View>;
}

const styles = StyleSheet.create({
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { ...theme.typography.title, color: theme.colors.text },
  subtitle: { ...theme.typography.caption, color: theme.colors.secondaryText },
});
