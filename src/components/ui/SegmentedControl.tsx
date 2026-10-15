import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme/theme';

export function SegmentedControl<T extends string>({ label, value, options, onChange, disabled = false, role = 'tab' }: {
  label: string; value: T; options: readonly { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void; disabled?: boolean; role?: 'tab' | 'radio';
}) {
  return <View accessibilityLabel={label} style={styles.group}>
    {options.map((option) => <Pressable key={option.value} accessibilityRole={role}
      accessibilityLabel={`${label}: ${option.label}`}
      accessibilityState={{ ...(role === 'tab' ? { selected: value === option.value } : { checked: value === option.value }), disabled: disabled || option.disabled === true }}
      disabled={disabled || option.disabled} onPress={() => onChange(option.value)}
      style={({ pressed }) => [styles.option, value === option.value && styles.selected, pressed && styles.pressed, (disabled || option.disabled) && styles.disabled]}>
      <Text style={[styles.label, value === option.value && styles.selectedLabel]}>{option.label}</Text>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', padding: 4, gap: 4, backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.control },
  option: { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 8, paddingVertical: 8, borderRadius: theme.radius.small, justifyContent: 'center', alignItems: 'center' },
  selected: { backgroundColor: theme.colors.surface },
  label: { ...theme.typography.label, color: theme.colors.secondaryText, textAlign: 'center' },
  selectedLabel: { color: theme.colors.accent },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
