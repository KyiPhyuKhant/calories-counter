import { Text, View } from 'react-native';
import { CuisinePicker } from '@/components/CuisinePicker';
import { FoodField, foodStyles, ServingUnitPicker } from '@/components/foodUi';
import type { FoodInput } from '@/domain/food';
import { foodText } from '@/i18n/foodMy';
import type { SimpleFoodForm } from '@/screens/simpleFoodForm';

export function SimpleFoodFields({ form, onChange, errors = {}, disabled = false }: {
  form: SimpleFoodForm; onChange: (changes: Partial<SimpleFoodForm>) => void;
  errors?: Partial<Record<keyof FoodInput, string>>; disabled?: boolean;
}) {
  return <>
    <FoodField label={foodText.name} value={form.name} onChange={(name) => onChange({ name })} disabled={disabled} error={errors.name} />
    <View style={foodStyles.field}><Text style={foodStyles.label}>{foodText.cuisine}</Text>
      <CuisinePicker value={form.cuisine} onChange={(cuisine) => onChange({ cuisine })} emptyLabel={foodText.uncategorized} disabled={disabled} />
    </View>
    <FoodField label={foodText.calories} value={form.calories} numeric onChange={(calories) => onChange({ calories })} disabled={disabled} error={errors.calories} />
    <FoodField label={foodText.amount} value={form.serving_amount} numeric onChange={(serving_amount) => onChange({ serving_amount })} disabled={disabled} error={errors.serving_amount} />
    <ServingUnitPicker value={form.serving_unit} onChange={(serving_unit) => onChange({ serving_unit })} disabled={disabled} />
  </>;
}
