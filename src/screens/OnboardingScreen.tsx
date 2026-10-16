import { useRef, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { ArrowRight, Check } from 'lucide-react-native';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { BrandLogo } from '@/components/BrandLogo';
import { AppInput } from '@/components/ui/AppInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useRepositories } from '@/data/DatabaseProvider';
import { activityLevels, calculateCalorieGoal, validateCalorieProfile } from '@/domain/calorieGoal';
import { useLocalProfile } from '@/navigation/LocalProfileProvider';
import { useOnboarding } from '@/navigation/OnboardingProvider';
import { calorieProfileFromForm, profileSetupErrors, type ProfileForm } from '@/navigation/profileSetup';
import { theme, uiStyles } from '@/theme/theme';

type Step = 'welcome' | 'profile' | 'activity' | 'target';
const measurements = [
  ['age', 'Age', 'years'], ['height_cm', 'Height', 'cm'],
  ['current_weight_kg', 'Current weight', 'kg'], ['target_weight_kg', 'Target weight', 'kg'],
] as const;

export function OnboardingScreen({ step }: { step: Step }) {
  const { form, setForm } = useOnboarding();
  const { profiles } = useRepositories();
  const { reload } = useLocalProfile();
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const savingRef = useRef(false);
  const input = calorieProfileFromForm(form);
  const bodyErrors = profileSetupErrors(form);
  const errors = step === 'profile' ? bodyErrors : validateCalorieProfile(input);
  const bodyValid = Object.keys(bodyErrors).length === 0;
  const [enteredWithValidBody] = useState(bodyValid);
  const valid = Object.keys(errors).length === 0;
  const estimate = valid && step !== 'profile' ? calculateCalorieGoal(input) : null;
  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((previous) => ({ ...previous, [key]: value })); setMessage('');
  }
  function next() {
    setSubmitted(true);
    if (valid) router.push(step === 'profile' ? '/onboarding/activity' : '/onboarding/target');
  }
  async function finish() {
    if (!valid || savingRef.current) return;
    savingRef.current = true; setSaving(true); setMessage('');
    try {
      await profiles.saveCalorieProfile(input);
      await reload();
    } catch {
      setMessage('Could not finish setup. Your information is still here. Please try again.');
    } finally { savingRef.current = false; setSaving(false); }
  }
  if ((step === 'activity' && !enteredWithValidBody) || (step === 'target' && !bodyValid)) return <Redirect href="/onboarding/profile" />;
  if (step === 'target' && !valid) return <Redirect href="/onboarding/activity" />;
  return <SafeAreaView edges={step === 'welcome' ? ['top', 'left', 'right', 'bottom'] : ['left', 'right', 'bottom']} style={styles.screen}>
    <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, step === 'welcome' && styles.welcome]}>
      {step === 'welcome' ? <>
        <View style={styles.art}><BrandLogo size={220} /></View>
        <AppHeader title="CalNote" subtitle="Track your meals and build habits around your goals." />
        <Text style={styles.detail}>Your data stays on this device. No account needed.</Text>
        <AppButton title="Get started" icon={ArrowRight} onPress={() => router.push('/onboarding/profile')} />
      </> : step === 'profile' ? <>
        <Text style={styles.detail}>Step 1 of 2</Text>
        <AppHeader title="Tell us about yourself" subtitle="These measurements help estimate your daily calorie needs." />
        <Text style={styles.label}>Sex used for the calorie equation</Text>
        <SegmentedControl label="Sex used for Mifflin-St Jeor" value={form.sex} role="radio"
          options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }]}
          onChange={(value) => update('sex', value)} />
        {submitted && errors.sex ? <Text accessibilityRole="alert" style={styles.error}>{errors.sex}</Text> : null}
        {measurements.map(([key, label, unit]) => <AppInput key={key} label={label} unit={unit} value={form[key]}
          keyboardType={key === 'age' ? 'number-pad' : 'decimal-pad'} maxLength={8}
          onChangeText={(value) => update(key, value)} error={submitted ? errors[key] : undefined} />)}
        <Text style={styles.detail}>For adults 18+. Not intended for pregnancy or breastfeeding. Individual medical needs may require professional advice.</Text>
        {submitted && errors.estimate ? <Text accessibilityRole="alert" style={styles.error}>{errors.estimate}</Text> : null}
        <AppButton title="Next" icon={ArrowRight} onPress={next} />
      </> : step === 'activity' ? <>
        <Text style={styles.detail}>Step 2 of 2</Text>
        <AppHeader title="Your activity and goal" />
        <Text style={styles.label}>Activity level</Text>
        {(Object.keys(activityLevels) as (keyof typeof activityLevels)[]).map((level) => <AppButton key={level}
          title={`${activityLevels[level].label} · ${activityLevels[level].detail}`}
          variant={form.activity_level === level ? 'secondary' : 'ghost'} icon={form.activity_level === level ? Check : undefined}
          accessibilityRole="radio" accessibilityState={{ checked: form.activity_level === level }} onPress={() => update('activity_level', level)} />)}
        <Text style={styles.label}>Your goal</Text>
        <SegmentedControl label="Goal" value={form.goal} role="radio" options={[
          { value: 'lose', label: 'Lose' }, { value: 'maintain', label: 'Maintain' }, { value: 'gain', label: 'Gain' },
        ]} onChange={(value) => update('goal', value)} />
        <AppInput label="Target weight" unit="kg" value={form.target_weight_kg} keyboardType="decimal-pad" maxLength={8}
          onChangeText={(value) => update('target_weight_kg', value)} error={submitted ? errors.target_weight_kg : undefined} />
        <View style={styles.row}><Text style={[styles.label, styles.grow]}>Set a manual calorie target</Text>
          <Switch accessibilityLabel="Set a manual calorie target" value={form.useManual} onValueChange={(value) => update('useManual', value)} trackColor={{ true: theme.colors.accent }} /></View>
        {form.useManual ? <AppInput label="Daily calorie target" unit="kcal" value={form.manual_calorie_target} keyboardType="number-pad" maxLength={5}
          onChangeText={(value) => update('manual_calorie_target', value)} error={submitted ? errors.manual_calorie_target : undefined} /> : null}
        {submitted ? Object.entries(errors).filter(([key]) => key !== 'target_weight_kg' && key !== 'manual_calorie_target').map(([key, error]) => <Text key={key} accessibilityRole="alert" style={styles.error}>{error}</Text>) : null}
        <AppButton title="See my daily target" icon={ArrowRight} onPress={next} />
      </> : estimate ? <>
        <AppHeader title="Your daily calorie target" subtitle="Estimated needs, not measured calorie burn." />
        <AppCard><Text style={styles.body}>Estimated BMR: {Math.round(estimate.bmr)} kcal</Text><Text style={styles.body}>Estimated TDEE: {Math.round(estimate.tdee)} kcal</Text></AppCard>
        <AppCard tinted><Text style={styles.label}>Your daily target</Text><Text style={styles.metric}>{estimate.target} kcal</Text><Text style={styles.detail}>{form.useManual ? 'Your manually adjusted target' : 'Based on your profile, activity, and goal'}</Text></AppCard>
        <Text style={styles.detail}>These are estimates, not medical advice. Adjust based on your progress and how you feel.</Text>
        <AppButton title="Start tracking" icon={Check} loading={saving} onPress={finish} />
        {message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { ...uiStyles.page, flexGrow: 1 },
  welcome: { justifyContent: 'center', gap: 28 },
  art: { alignSelf: 'center' },
  body: { ...theme.typography.body, color: theme.colors.text },
  detail: { ...theme.typography.caption, color: theme.colors.secondaryText },
  label: { ...theme.typography.label, color: theme.colors.text },
  error: { ...theme.typography.caption, color: theme.colors.danger },
  metric: { ...theme.typography.metric, color: theme.colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 }, grow: { flex: 1 },
});
