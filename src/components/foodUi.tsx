import { useState, type PropsWithChildren } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown } from 'lucide-react-native';

import { type Food, type ServingUnit } from '@/domain/food';
import { foodFormUnits, foodText, unitLabels } from '@/i18n/foodMy';
import { theme } from '@/theme/theme';
import { AppInput } from '@/components/ui/AppInput';

export function foodSourceLabel(food: Food) {
  return food.source === 'bundled' ? (isDevelopmentFood(food) ? 'အတည်မပြုထားသော စမ်းသပ်နမူနာ' : 'ထည့်သွင်းစာရင်း')
    : food.source === 'external' ? 'ပြင်ပမှ သိမ်းထားသည်' : 'ကိုယ်ပိုင်အစားအစာ';
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

export function FoodSheet({ visible, title, onClose, children }: PropsWithChildren<{
  visible: boolean; title: string; onClose: () => void;
}>) {
  return <Modal visible={visible} presentationStyle="pageSheet" animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={foodStyles.screen}><ScrollView contentContainerStyle={foodStyles.content}>
      <Text accessibilityRole="header" style={foodStyles.title}>{title}</Text>
      {children}
    </ScrollView></SafeAreaView>
  </Modal>;
}

export function ServingUnitPicker({ value, onChange, disabled }: { value: ServingUnit; onChange: (unit: ServingUnit) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return <View style={foodStyles.field}>
    <Text style={foodStyles.label}>{foodText.unit}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${foodText.unit}၊ ${unitLabels[value]}`} accessibilityState={{ disabled }} disabled={disabled}
      style={[foodStyles.input, { flexDirection: 'row', alignItems: 'center', gap: 8 }]} onPress={() => setOpen(true)}>
      <Text style={[foodStyles.body, { flex: 1 }]}>{unitLabels[value]}</Text><ChevronDown size={20} color={theme.colors.accent} />
    </Pressable>
    <FoodSheet visible={open} title={foodText.unit} onClose={() => setOpen(false)}>
      {foodFormUnits.map((unit) => <Pressable key={unit} accessibilityRole="radio" accessibilityState={{ checked: value === unit }}
        style={[foodStyles.option, value === unit ? foodStyles.selected : undefined]}
        onPress={() => { onChange(unit); setOpen(false); }}><Text style={foodStyles.body}>{unitLabels[unit]}</Text></Pressable>)}
      <Pressable accessibilityRole="button" style={foodStyles.button} onPress={() => setOpen(false)}><Text style={foodStyles.buttonText}>{foodText.cancel}</Text></Pressable>
    </FoodSheet>
  </View>;
}

export const foodStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
  title: { ...theme.typography.title, fontSize: 24, lineHeight: undefined, color: theme.colors.text },
  body: { ...theme.typography.body, lineHeight: undefined, color: theme.colors.text },
  label: { ...theme.typography.label, lineHeight: undefined, color: theme.colors.text },
  detail: { ...theme.typography.caption, lineHeight: undefined, color: theme.colors.secondaryText },
  error: { ...theme.typography.caption, lineHeight: undefined, color: theme.colors.danger },
  field: { gap: 8 },
  input: { minHeight: 50, padding: 12, backgroundColor: theme.colors.surface, borderRadius: theme.radius.control, borderWidth: 1, borderColor: theme.colors.border, ...theme.typography.body, lineHeight: undefined, color: theme.colors.text },
  button: { minHeight: 50, padding: 14, backgroundColor: theme.colors.accent, borderRadius: theme.radius.control, alignItems: 'center', justifyContent: 'center' },
  buttonText: { ...theme.typography.button, lineHeight: undefined, color: theme.colors.surface },
  destructive: { backgroundColor: theme.colors.danger },
  disabled: { opacity: 0.5 },
  option: { minHeight: 48, padding: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control },
  selected: { backgroundColor: theme.colors.accentSurface, borderColor: theme.colors.accent },
  status: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  nutrition: { ...theme.typography.metric, lineHeight: undefined, color: theme.colors.accent },
});
