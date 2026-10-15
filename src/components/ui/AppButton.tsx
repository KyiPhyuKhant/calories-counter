import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { theme } from '@/theme/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type AppButtonProps = Omit<PressableProps, 'children'> & {
  title: string; icon?: LucideIcon; variant?: Variant; loading?: boolean;
};

export function AppButton({ title, icon: Icon, variant = 'primary', loading = false, disabled = false, style, accessibilityState, accessibilityRole = 'button', ...props }: AppButtonProps) {
  const blocked = disabled || loading;
  const color = variant === 'primary' ? theme.colors.onPrimary : variant === 'danger' ? theme.colors.surface : theme.colors.accent;
  return <Pressable {...props} accessibilityRole={accessibilityRole} accessibilityLabel={props.accessibilityLabel ?? title}
    accessibilityState={{ ...accessibilityState, disabled: blocked, busy: loading }} disabled={blocked}
    style={(state) => [styles.button, styles[variant], state.pressed && styles.pressed, blocked && styles.disabled, typeof style === 'function' ? style(state) : style]}>
    {Icon || loading ? <View style={styles.icon}>{loading ? <ActivityIndicator accessibilityLabel="ဖတ်ယူနေသည်" size="small" color={color} /> : Icon ? <Icon size={20} color={color} /> : null}</View> : null}
    <Text style={[styles.title, { color }]}>{title}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 50, paddingHorizontal: 16, paddingVertical: 12, borderRadius: theme.radius.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primary: { backgroundColor: theme.colors.primary },
  secondary: { backgroundColor: theme.colors.accentSurface },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: theme.colors.danger },
  title: { ...theme.typography.button, lineHeight: undefined, textAlign: 'center', flexShrink: 1 },
  icon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
});
