import { StyleSheet, View, type ViewProps } from 'react-native';
import { theme } from '@/theme/theme';

export function AppCard({ children, style, tinted = false, ...props }: ViewProps & { tinted?: boolean }) {
  return <View {...props} style={[styles.card, tinted && styles.tinted, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { padding: theme.spacing.medium, gap: theme.spacing.regular, borderRadius: theme.radius.card, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, ...theme.shadow.card },
  tinted: { backgroundColor: theme.colors.accentSurface, borderColor: theme.colors.accentSurface },
});
