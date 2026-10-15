import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { servingUnits, type Food, type ServingUnit } from '@/domain/food';
import { theme } from '@/theme/theme';
import { AppInput } from '@/components/ui/AppInput';

export function foodSourceLabel(food: Food) {
  return food.source === 'bundled' ? (isDevelopmentFood(food) ? 'Bundled development sample - unverified' : 'Bundled food catalog - nutrition unverified')
    : food.source === 'external' ? `External (${food.provider}) - saved locally` : 'Custom food';
}

export function isDevelopmentFood(food: Pick<Food, 'source' | 'nutrition_status'>) {
  return food.source === 'bundled' && (food.nutrition_status === 'development' || food.nutrition_status === undefined);
}

export function FoodField({ label, value, onChange, error, numeric = false, multiline = false, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; error?: string;
  numeric?: boolean; multiline?: boolean; disabled?: boolean;
}) {
  return <AppInput label={label} value={value} onChangeText={onChange} editable={!disabled} error={error}
      keyboardType={numeric ? 'decimal-pad' : 'default'} multiline={multiline}
      maxLength={multiline ? 2000 : numeric ? 12 : 120} />;
}

export function ServingUnitPicker({ value, onChange, disabled }: { value: ServingUnit; onChange: (unit: ServingUnit) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return <View style={foodStyles.field}>
    <Text style={foodStyles.label}>Serving unit</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Choose serving unit, ${value}`} accessibilityState={{ disabled }} disabled={disabled}
      style={foodStyles.input} onPress={() => setOpen(true)}><Text style={foodStyles.body}>{value}</Text></Pressable>
    <Modal visible={open} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={foodStyles.screen}>
        <ScrollView contentContainerStyle={foodStyles.content}>
          <Text accessibilityRole="header" style={foodStyles.title}>Serving unit</Text>
          {servingUnits.map((unit) => <Pressable key={unit} accessibilityRole="radio" accessibilityState={{ checked: value === unit }}
            style={[foodStyles.option, value === unit ? foodStyles.selected : undefined]}
            onPress={() => { onChange(unit); setOpen(false); }}><Text style={foodStyles.body}>{unit}</Text></Pressable>)}
          <Pressable accessibilityRole="button" style={foodStyles.button} onPress={() => setOpen(false)}><Text style={foodStyles.buttonText}>Cancel</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </View>;
}

export const foodStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 24, gap: 20, width: '100%', maxWidth: 560, alignSelf: 'center' },
  title: { ...theme.typography.title, color: theme.colors.text },
  body: { ...theme.typography.body, color: theme.colors.text },
  label: { ...theme.typography.label, color: theme.colors.text },
  detail: { ...theme.typography.caption, color: theme.colors.secondaryText },
  error: { ...theme.typography.caption, color: theme.colors.danger },
  field: { gap: 8 },
  input: { minHeight: 50, padding: 12, backgroundColor: theme.colors.surface, borderRadius: theme.radius.control, borderWidth: 1, borderColor: theme.colors.border, ...theme.typography.body, color: theme.colors.text },
  notes: { minHeight: 100, textAlignVertical: 'top' },
  invalid: { borderColor: theme.colors.danger },
  button: { minHeight: 50, padding: 14, backgroundColor: theme.colors.accent, borderRadius: theme.radius.control, alignItems: 'center', justifyContent: 'center' },
  buttonText: { ...theme.typography.button, color: theme.colors.surface },
  destructive: { backgroundColor: theme.colors.danger },
  disabled: { opacity: 0.5 },
  option: { minHeight: 48, padding: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control },
  selected: { backgroundColor: theme.colors.accentSurface, borderColor: theme.colors.accent },
  status: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  nutrition: { ...theme.typography.metric, color: theme.colors.accent },
});
