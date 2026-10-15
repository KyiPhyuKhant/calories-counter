import Constants from 'expo-constants';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/ui/AppHeader';
import { theme } from '@/theme/theme';

export function AppSettingsScreen() {
  const settings = [
    ['Storage', 'On this device only'], ['Appearance', 'Light'], ['Weight & height', 'Kilograms & centimeters'],
    ['Energy', 'Kilocalories (kcal)'], ['Version', Constants.expoConfig?.version ?? 'Unavailable'],
  ];
  return <SafeAreaView edges={['left', 'right']} style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
    <AppHeader title="App settings" />
    {settings.map(([label, value]) => <View key={label} style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>)}
    <Text style={styles.detail}>Your profile, foods, diary, plans, and measurements are saved locally. No account or internet connection is required.</Text>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 24, gap: 20, width: '100%', maxWidth: 560, alignSelf: 'center' },
  row: { gap: 6, paddingVertical: 12, borderBottomWidth: 1, borderColor: theme.colors.border },
  label: { ...theme.typography.label, color: theme.colors.text }, value: { ...theme.typography.body, color: theme.colors.secondaryText },
  detail: { ...theme.typography.caption, color: theme.colors.secondaryText },
});
