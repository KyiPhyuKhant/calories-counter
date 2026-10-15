import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View, type TextInputProps } from 'react-native';
import { FormInput } from '@/components/FormInput';
import { theme } from '@/theme/theme';

export type AppInputProps = TextInputProps & {
  label: string; hideLabel?: boolean; error?: string; hint?: string; icon?: LucideIcon; unit?: string; variant?: 'default' | 'search';
};

export function AppInput({ label, hideLabel = false, error, hint, icon: Icon, unit, variant = 'default', style, ...props }: AppInputProps) {
  return <View style={styles.field}>
    {!hideLabel ? <Text style={styles.label}>{label}</Text> : null}
    <View style={[styles.control, variant === 'search' && styles.search, props.multiline && styles.multiline, Boolean(error) && styles.invalid]}>
      {Icon ? <Icon size={20} color={theme.colors.secondaryText} /> : null}
      <FormInput {...props} accessibilityLabel={props.accessibilityLabel ?? label} accessibilityHint={hint ?? props.accessibilityHint}
        error={error} style={[styles.input, props.multiline && styles.notes, style]} />
      {unit ? <Text style={styles.hint}>{unit}</Text> : null}
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { ...theme.typography.label, lineHeight: undefined, color: theme.colors.text },
  control: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, backgroundColor: theme.colors.surface },
  search: { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.surfaceMuted },
  input: { ...theme.typography.body, lineHeight: undefined, color: theme.colors.text, flex: 1, padding: 0, minWidth: 0 },
  multiline: { alignItems: 'flex-start' },
  notes: { minHeight: 100, textAlignVertical: 'top' },
  invalid: { borderColor: theme.colors.danger },
  error: { ...theme.typography.caption, lineHeight: undefined, color: theme.colors.danger },
  hint: { ...theme.typography.caption, lineHeight: undefined, color: theme.colors.secondaryText, flexShrink: 1 },
});
