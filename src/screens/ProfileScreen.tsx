import { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRepositories } from '@/data/DatabaseProvider';
import {
  activityLevels, calculateCalorieGoal, validateCalorieProfile,
  type ActivityLevel, type CalorieProfile, type EquationSex, type Goal,
} from '@/domain/calorieGoal';
import { theme } from '@/theme/theme';

type Form = {
  sex: EquationSex | '';
  age: string;
  height_cm: string;
  current_weight_kg: string;
  target_weight_kg: string;
  activity_level: ActivityLevel;
  goal: Goal;
  manual_calorie_target: string;
  useManual: boolean;
};
const emptyForm: Form = {
  sex: '', age: '', height_cm: '', current_weight_kg: '', target_weight_kg: '',
  activity_level: 'sedentary', goal: 'maintain', manual_calorie_target: '', useManual: false,
};
function number(value: string) {
  return /^\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : NaN;
}
function toInput(form: Form): CalorieProfile {
  return {
    sex: form.sex as EquationSex, age: number(form.age), height_cm: number(form.height_cm),
    current_weight_kg: number(form.current_weight_kg), target_weight_kg: number(form.target_weight_kg),
    activity_level: form.activity_level, goal: form.goal,
    manual_calorie_target: form.useManual ? number(form.manual_calorie_target) : null,
  };
}

function NumericField({ label, value, onChange, error, disabled, integer = false }: {
  label: string; value: string; onChange: (value: string) => void;
  error?: string; disabled: boolean; integer?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label} value={value} onChangeText={onChange}
        keyboardType={integer ? 'number-pad' : 'decimal-pad'} editable={!disabled}
        style={[styles.input, error ? styles.invalidInput : undefined]} maxLength={8}
      />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function Segments<T extends string>({ label, value, options, onChange, disabled }: {
  label: string; value: string; options: { value: T; label: string }[];
  onChange: (value: T) => void; disabled: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segments}>
        {options.map((option) => (
          <Pressable key={option.value} accessibilityRole="radio"
            accessibilityLabel={`${label}: ${option.label}`}
            accessibilityState={{ checked: value === option.value, disabled }}
            disabled={disabled} onPress={() => onChange(option.value)}
            style={[styles.segment, value === option.value ? styles.selected : undefined]}>
            <Text style={[styles.segmentText, value === option.value ? styles.selectedText : undefined]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function ProfileScreen() {
  const { profiles } = useRepositories();
  const [form, setForm] = useState<Form>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [activityOpen, setActivityOpen] = useState(false);

  useEffect(() => {
    let active = true;
    profiles.get().then((profile) => {
      if (!active) return;
      if (profile) setForm({
        sex: profile.sex ?? '', age: profile.age?.toString() ?? '',
        height_cm: profile.height_cm?.toString() ?? '',
        current_weight_kg: profile.current_weight_kg?.toString() ?? '',
        target_weight_kg: profile.target_weight_kg?.toString() ?? '',
        activity_level: profile.activity_level ?? 'sedentary', goal: profile.goal ?? 'maintain',
        manual_calorie_target: profile.manual_calorie_target?.toString() ?? '',
        useManual: profile.manual_calorie_target !== null,
      });
      setLoading(false);
    }).catch(() => {
      if (active) { setLoadFailed(true); setLoading(false); }
    });
    return () => { active = false; };
  }, [profiles, loadAttempt]);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setMessage('');
  }
  const input = toInput(form);
  const errors = validateCalorieProfile(input);
  const estimate = Object.keys(errors).length ? null : calculateCalorieGoal(input);
  // Keep the suggested estimate visible while a manual value is being edited.
  const suggestedInput = { ...input, manual_calorie_target: null };
  const suggestion = Object.keys(validateCalorieProfile(suggestedInput)).length
    ? null : calculateCalorieGoal(suggestedInput);

  async function save() {
    setSubmitted(true);
    setMessage('');
    if (Object.keys(errors).length) {
      setMessage('Check the highlighted fields before saving.');
      return;
    }
    setSaving(true);
    try {
      await profiles.saveCalorieProfile(input);
      setMessage('Profile saved on this device.');
    } catch {
      setMessage('Could not save your profile. Your edits are still here; please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={styles.status}><ActivityIndicator color={theme.colors.accent} accessibilityLabel="Loading profile" /></View>;
  if (loadFailed) return (
    <View style={styles.status}>
      <Text accessibilityRole="alert" style={styles.body}>Could not load your profile.</Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => {
        setLoadFailed(false); setLoading(true); setLoadAttempt((value) => value + 1);
      }}><Text style={styles.buttonText}>Try again</Text></Pressable>
    </View>
  );

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>Your daily goal</Text>
          <Text style={styles.body}>Estimated needs, not measured calorie burn. For adults 18+; not intended for pregnancy or breastfeeding. Medical conditions may need individual advice.</Text>

          <Segments label="Sex used for Mifflin-St Jeor" value={form.sex} disabled={saving}
            options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }]}
            onChange={(value: EquationSex) => update('sex', value)} />
          {submitted && errors.sex ? <Text style={styles.error}>{errors.sex}</Text> : null}
          <NumericField label="Age (years)" value={form.age} integer disabled={saving}
            onChange={(value) => update('age', value)} error={submitted ? errors.age : undefined} />
          <NumericField label="Height (cm)" value={form.height_cm} disabled={saving}
            onChange={(value) => update('height_cm', value)} error={submitted ? errors.height_cm : undefined} />
          <NumericField label="Current weight (kg)" value={form.current_weight_kg} disabled={saving}
            onChange={(value) => update('current_weight_kg', value)} error={submitted ? errors.current_weight_kg : undefined} />
          <NumericField label="Target weight (kg)" value={form.target_weight_kg} disabled={saving}
            onChange={(value) => update('target_weight_kg', value)} error={submitted ? errors.target_weight_kg : undefined} />

          <View style={styles.field}>
            <Text style={styles.label}>Activity level</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Choose activity level" disabled={saving}
              style={styles.input} onPress={() => setActivityOpen(true)}>
              <Text style={styles.body}>{activityLevels[form.activity_level].label}</Text>
              <Text style={styles.detail}>{activityLevels[form.activity_level].detail}</Text>
            </Pressable>
          </View>
          <Segments label="Goal" value={form.goal} disabled={saving}
            options={[{ value: 'lose', label: 'Lose' }, { value: 'maintain', label: 'Maintain' }, { value: 'gain', label: 'Gain' }]}
            onChange={(value: Goal) => update('goal', value)} />
          {submitted && errors.goal ? <Text style={styles.error}>{errors.goal}</Text> : null}
          {submitted && errors.estimate ? <Text accessibilityRole="alert" style={styles.error}>{errors.estimate}</Text> : null}

          {suggestion ? (
            <View style={styles.estimate}>
              <Text accessibilityRole="header" style={styles.estimateTitle}>Estimated daily needs</Text>
              <Text style={styles.body}>Resting needs (BMR): {Math.round(suggestion.bmr)} kcal</Text>
              <Text style={styles.body}>Maintenance (TDEE): {Math.round(suggestion.tdee)} kcal</Text>
              <Text style={styles.target}>{suggestion.suggested} kcal/day</Text>
              <Text style={styles.detail}>Suggested target for your goal</Text>
              <Text style={styles.detail}>Adjustment range: {suggestion.minimum}-{suggestion.maximum} kcal/day. Limits reduce extreme adjustments; they do not guarantee suitability for everyone.</Text>
              {form.goal === 'lose' && suggestion.suggested >= suggestion.tdee ? <Text style={styles.detail}>No deficit is suggested at these estimated needs.</Text> : null}
            </View>
          ) : null}
          <View style={styles.switchRow}>
            <Text style={[styles.label, styles.switchLabel]}>Adjust calorie target manually</Text>
            <Switch accessibilityLabel="Adjust calorie target manually" value={form.useManual}
              disabled={saving} onValueChange={(value) => update('useManual', value)}
              trackColor={{ true: theme.colors.accent }} />
          </View>
          {form.useManual ? <NumericField label="Manual target (kcal/day)" value={form.manual_calorie_target}
            integer disabled={saving} onChange={(value) => update('manual_calorie_target', value)}
            error={submitted ? errors.manual_calorie_target : undefined} /> : null}
          {estimate && form.useManual ? <Text style={styles.body}>Your selected target: {estimate.target} kcal/day</Text> : null}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving }} disabled={saving}
            style={[styles.button, saving ? styles.disabled : undefined]} onPress={save}>
            <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save profile'}</Text>
          </Pressable>
          {message ? <Text accessibilityRole="alert" style={styles.body}>{message}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal visible={activityOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setActivityOpen(false)}>
        <SafeAreaView style={styles.screen}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text accessibilityRole="header" style={styles.title}>Activity level</Text>
            {(Object.keys(activityLevels) as ActivityLevel[]).map((level) => (
              <Pressable key={level} accessibilityRole="radio" accessibilityState={{ checked: form.activity_level === level }}
                style={[styles.activityOption, form.activity_level === level ? styles.selected : undefined]}
                onPress={() => { update('activity_level', level); setActivityOpen(false); }}>
                <Text style={styles.label}>{activityLevels[level].label}</Text>
                <Text style={styles.detail}>{activityLevels[level].detail} (factor {activityLevels[level].factor})</Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => setActivityOpen(false)}>
              <Text style={styles.buttonText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  status: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 },
  content: { padding: 24, gap: 20, width: '100%', maxWidth: 560, alignSelf: 'center' },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '700', color: theme.colors.text },
  body: { fontSize: 17, lineHeight: 26, color: theme.colors.text },
  detail: { fontSize: 14, lineHeight: 22, color: theme.colors.secondaryText },
  label: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: theme.colors.text },
  field: { gap: 8 },
  input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, backgroundColor: theme.colors.surface, fontSize: 17, color: theme.colors.text },
  invalidInput: { borderColor: '#A12828' },
  error: { color: '#A12828', fontSize: 14, lineHeight: 22 },
  segments: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  segment: { flex: 1, minHeight: 48, padding: 10, borderRadius: 8, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  segmentText: { fontSize: 16, lineHeight: 24, color: theme.colors.text, textAlign: 'center' },
  selected: { backgroundColor: theme.colors.accentSurface, borderColor: theme.colors.accent },
  selectedText: { color: theme.colors.accent, fontWeight: '600' },
  estimate: { padding: 20, gap: 8, borderRadius: 8, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  estimateTitle: { fontSize: 20, lineHeight: 28, fontWeight: '600', color: theme.colors.text },
  target: { fontSize: 28, lineHeight: 36, fontWeight: '700', color: theme.colors.accent },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  switchLabel: { flex: 1 },
  button: { minHeight: 48, padding: 16, borderRadius: 8, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 17, lineHeight: 24, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  activityOption: { padding: 16, gap: 8, minHeight: 64, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8 },
});
