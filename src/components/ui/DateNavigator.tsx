import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { DiaryDateField, DiaryIconButton } from '@/components/diaryUi';
import { shiftCalendarDate } from '@/domain/diary';
import { theme } from '@/theme/theme';

export function DateNavigator({ value, onChange, disabled = false }: { value: string; onChange: (date: string) => void; disabled?: boolean }) {
  return <View style={styles.row}>
    <DiaryIconButton icon={ChevronLeft} label="ယခင်နေ့" disabled={disabled || value === '1900-01-01'} onPress={() => onChange(shiftCalendarDate(value, -1))} />
    <DiaryDateField value={value} onChange={onChange} disabled={disabled} />
    <DiaryIconButton icon={ChevronRight} label="နောက်နေ့" disabled={disabled || value === '2100-12-31'} onPress={() => onChange(shiftCalendarDate(value, 1))} />
  </View>;
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.control } });
