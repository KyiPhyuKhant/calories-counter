import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CalendarDays, type LucideIcon } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { FoodSheet, foodStyles } from '@/components/foodUi';
import { localCalendarDate, meals, validateCalendarDate, type Meal } from '@/domain/diary';
import { foodDateLabel, foodText, mealLabels } from '@/i18n/foodMy';
import { theme } from '@/theme/theme';

export function DiaryIconButton({ icon: Icon, label, onPress, disabled = false, color = theme.colors.accent }: {
  icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean; color?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={[diaryStyles.iconButton, disabled ? foodStyles.disabled : undefined]}>
    <Icon size={22} color={color} />
  </Pressable>;
}

export function DiaryDateField({ value, onChange, disabled = false, color }: { value: string; onChange: (date: string) => void; disabled?: boolean; color?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(() => validateCalendarDate(value));
  const date = validateCalendarDate(value);
  return <View style={diaryStyles.dateField}>
    <Pressable accessibilityRole="button" accessibilityLabel={`ရက်စွဲရွေးရန်၊ ${foodDateLabel(value)}`} accessibilityState={{ disabled }} disabled={disabled}
      style={diaryStyles.dateButton} onPress={() => { setPending(date); setOpen(true); }}>
      <CalendarDays size={20} color={color ?? theme.colors.accent} />
      <Text style={diaryStyles.dateText}>{foodDateLabel(value)}</Text>
    </Pressable>
    <FoodSheet visible={open} title="ရက်စွဲရွေးရန်" onClose={() => setOpen(false)}>
      <DateTimePicker value={pending} mode="date" locale="my_MM@calendar=gregorian" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        minimumDate={new Date(1900, 0, 1)} maximumDate={new Date(2100, 11, 31)}
        themeVariant="light" style={diaryStyles.picker} onValueChange={(_, selected) => setPending(selected)} onDismiss={() => setOpen(false)} />
      <Pressable accessibilityRole="button" style={[foodStyles.button, color ? { backgroundColor: color } : undefined]} onPress={() => { onChange(localCalendarDate(pending)); setOpen(false); }}>
        <Text style={[foodStyles.buttonText, color ? { color: theme.colors.surface } : undefined]}>ရွေးချယ်ရန်</Text></Pressable>
      <Pressable accessibilityRole="button" style={foodStyles.option} onPress={() => setOpen(false)}><Text style={foodStyles.body}>{foodText.cancel}</Text></Pressable>
    </FoodSheet>
  </View>;
}

export function DiaryMealField({ value, onChange, disabled }: { value: Meal; onChange: (meal: Meal) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return <View style={foodStyles.field}>
    <Text style={foodStyles.label}>စားသုံးချိန်</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`စားသုံးချိန်ရွေးရန်၊ ${mealLabel(value)}`} accessibilityState={{ disabled }} disabled={disabled} style={foodStyles.input} onPress={() => setOpen(true)}>
      <Text style={foodStyles.body}>{mealLabel(value)}</Text></Pressable>
    <FoodSheet visible={open} title="စားသုံးချိန်ရွေးရန်" onClose={() => setOpen(false)}>
      {meals.map((meal) => <Pressable key={meal} accessibilityRole="radio" accessibilityState={{ checked: meal === value }}
        style={[foodStyles.option, meal === value ? foodStyles.selected : undefined]} onPress={() => { onChange(meal); setOpen(false); }}>
        <Text style={foodStyles.body}>{mealLabel(meal)}</Text></Pressable>)}
      <Pressable accessibilityRole="button" style={foodStyles.button} onPress={() => setOpen(false)}><Text style={foodStyles.buttonText}>{foodText.cancel}</Text></Pressable>
    </FoodSheet>
  </View>;
}

export function mealLabel(meal: Meal) { return mealLabels[meal]; }
export function caloriesLabel(value: number) { return `${Number(value.toFixed(1))} kcal`; }

export const mealDayStyles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.regular, flexWrap: 'wrap' },
  title: { ...theme.typography.heading, color: theme.colors.text, flexShrink: 1 },
  toolbarButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.small, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.planningSurface, maxWidth: '100%' },
  actionText: { ...theme.typography.caption, fontWeight: '600', color: theme.colors.accent, flexShrink: 1 },
  summary: { gap: 6, padding: theme.spacing.regular, borderRadius: theme.radius.control, backgroundColor: theme.colors.planningSurface },
  mealCard: { gap: theme.spacing.small, padding: theme.spacing.regular, borderRadius: theme.radius.card, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderLeftWidth: 3, borderLeftColor: theme.colors.accent },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: theme.spacing.small },
  confirmButton: { minHeight: 44, alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.small, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },
  confirmText: { ...theme.typography.caption, fontWeight: '600', color: theme.colors.onMealPlan, textAlign: 'center' },
});

export const diaryStyles = StyleSheet.create({
  dateField: { flex: 1 },
  dateButton: { minHeight: 48, padding: 8, gap: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  dateText: { ...theme.typography.button, flexShrink: 1, textAlign: 'center', color: theme.colors.text },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  picker: { height: 216, width: '100%' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  section: { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 16, gap: 8 },
  mealHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  entry: { flex: 1, gap: 4, paddingVertical: 8 },
  controls: { flexDirection: 'row', gap: 8 },
  control: { flex: 1 },
});
