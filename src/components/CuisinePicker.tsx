import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/ui/AppButton';
import { foodStyles } from '@/components/foodUi';
import { cuisines, cuisineLabels, type Cuisine } from '@/domain/food';
import { theme } from '@/theme/theme';
import { foodText } from '@/i18n/foodMy';

export function CuisinePicker({ value, onChange, emptyLabel = foodText.all, disabled = false }: {
  value: Cuisine | null; onChange: (value: Cuisine | null) => void; emptyLabel?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = value === null ? emptyLabel : cuisineLabels[value];
  return <View style={foodStyles.field}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${foodText.cuisine}၊ ${label}`} accessibilityHint="အမျိုးအစားရွေးချယ်ရန် ဖွင့်ပါ"
      accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={() => setOpen(true)} style={[styles.control, disabled && styles.disabled]}>
      <Text style={[foodStyles.body, styles.grow]}>{label}</Text><ChevronDown size={20} color={theme.colors.accent} />
    </Pressable>
    <Modal visible={open} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={foodStyles.screen}><ScrollView contentContainerStyle={foodStyles.content}>
        <Text accessibilityRole="header" style={foodStyles.title}>{foodText.cuisine}</Text>
        {([null, ...cuisines] as const).map((cuisine) => <Pressable key={cuisine ?? 'all'} accessibilityRole="radio"
          accessibilityLabel={cuisine === null ? emptyLabel : cuisineLabels[cuisine]} accessibilityState={{ checked: value === cuisine }}
          style={[styles.control, value === cuisine && foodStyles.selected]} onPress={() => { onChange(cuisine); setOpen(false); }}>
          <Text style={[foodStyles.body, styles.grow]}>{cuisine === null ? emptyLabel : cuisineLabels[cuisine]}</Text>
          {value === cuisine ? <Check size={20} color={theme.colors.accent} /> : null}
        </Pressable>)}
        <AppButton title={foodText.cancel} variant="secondary" onPress={() => setOpen(false)} />
      </ScrollView></SafeAreaView>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  control: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: theme.radius.control, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
  grow: { flex: 1 },
  disabled: { opacity: 0.5 },
});
