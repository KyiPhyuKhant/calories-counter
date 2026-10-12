import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { servingUnits, type Food, type ServingUnit } from '@/domain/food';
import { theme } from '@/theme/theme';

export function foodSourceLabel(food: Food) {
  return food.source === 'bundled' ? 'Bundled development sample - unverified'
    : food.source === 'external' ? `External (${food.provider}) - saved locally` : 'Custom food';
}

export function FoodField({ label, value, onChange, error, numeric = false, multiline = false, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; error?: string;
  numeric?: boolean; multiline?: boolean; disabled?: boolean;
}) {
  return <View style={foodStyles.field}>
    <Text style={foodStyles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled}
      keyboardType={numeric ? 'decimal-pad' : 'default'} multiline={multiline}
      maxLength={multiline ? 2000 : numeric ? 12 : 120}
      style={[foodStyles.input, multiline ? foodStyles.notes : undefined, error ? foodStyles.invalid : undefined]} />
    {error ? <Text accessibilityRole="alert" style={foodStyles.error}>{error}</Text> : null}
  </View>;
}

export function ServingUnitPicker({ value, onChange, disabled }: { value: ServingUnit; onChange: (unit: ServingUnit) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return <View style={foodStyles.field}>
    <Text style={foodStyles.label}>Serving unit</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Choose serving unit" disabled={disabled}
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
  title: { fontSize: 26, lineHeight: 34, fontWeight: '700', color: theme.colors.text },
  body: { fontSize: 17, lineHeight: 26, color: theme.colors.text },
  label: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: theme.colors.text },
  detail: { fontSize: 14, lineHeight: 22, color: theme.colors.secondaryText },
  error: { fontSize: 14, lineHeight: 22, color: '#A12828' },
  field: { gap: 8 },
  input: { minHeight: 48, padding: 12, backgroundColor: theme.colors.surface, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, fontSize: 17, color: theme.colors.text },
  notes: { minHeight: 100, textAlignVertical: 'top' },
  invalid: { borderColor: '#A12828' },
  button: { minHeight: 48, padding: 14, backgroundColor: theme.colors.accent, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: '#FFFFFF' },
  destructive: { backgroundColor: '#A12828' },
  disabled: { opacity: 0.5 },
  option: { minHeight: 48, padding: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8 },
  selected: { backgroundColor: theme.colors.accentSurface, borderColor: theme.colors.accent },
  status: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  nutrition: { fontSize: 28, lineHeight: 36, fontWeight: '700', color: theme.colors.accent },
});
