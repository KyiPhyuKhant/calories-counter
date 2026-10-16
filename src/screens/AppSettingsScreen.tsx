import Constants from 'expo-constants';
import { Trash2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '@/components/BrandLogo';
import { AppButton } from '@/components/ui/AppButton';
import { useRepositories } from '@/data/DatabaseProvider';
import { theme, uiStyles } from '@/theme/theme';

const clearLabel = 'Clear all data';

function SettingRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}

export function AppSettingsScreen() {
  const { data } = useRepositories();
  const busy = useRef(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');

  async function clearData() {
    if (busy.current) return;
    busy.current = true; setClearing(true); setError('');
    try {
      // Repository subscribers refresh the profile guard and return to onboarding.
      await data.clearAll();
    } catch {
      setError('Could not clear data. Your data is unchanged. Please try again.');
    } finally { busy.current = false; setClearing(false); }
  }

  function confirmClear() {
    if (busy.current) return;
    Alert.alert(clearLabel,
      'This permanently deletes your profile, foods, diary, plans, and weight history and returns to setup. This cannot be undone. Bundled foods are restored on the next launch.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete all', style: 'destructive', onPress: () => { void clearData(); } },
      ],
    );
  }

  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.brand}><BrandLogo size={88} /><Text style={styles.name}>CalNote</Text></View>

    <Text accessibilityRole="header" style={styles.section}>General</Text>
    <SettingRow label="Language" value="English" />
    <SettingRow label="Appearance" value="Light" />
    <SettingRow label="Weight" value="Kilograms (kg)" />
    <SettingRow label="Height" value="Centimeters (cm)" />
    <SettingRow label="Energy" value="Kilocalories (kcal)" />

    <Text accessibilityRole="header" style={styles.section}>Data & Privacy</Text>
    <Text style={styles.value}>Your data stays on this device. No account or internet connection required.</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <AppButton title={clearing ? 'Clearing...' : clearLabel} icon={Trash2} variant="danger" loading={clearing} loadingLabel="Clearing data" onPress={confirmClear} />

    <Text accessibilityRole="header" style={styles.section}>About</Text>
    <SettingRow label="Version" value={Constants.expoConfig?.version ?? 'Unavailable'} />
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: uiStyles.page,
  brand: { alignItems: 'center', gap: theme.spacing.small, paddingVertical: theme.spacing.small },
  name: { ...theme.typography.title, color: theme.colors.text },
  section: { ...theme.typography.label, color: theme.colors.accent, marginTop: theme.spacing.regular },
  row: { gap: theme.spacing.extraSmall, paddingVertical: theme.spacing.small, borderBottomWidth: 1, borderColor: theme.colors.border },
  label: { ...theme.typography.label, color: theme.colors.text },
  value: { ...theme.typography.caption, color: theme.colors.secondaryText },
  error: { ...theme.typography.caption, color: theme.colors.danger },
});
