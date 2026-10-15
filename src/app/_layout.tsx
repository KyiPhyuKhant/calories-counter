import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { foodStyles } from '@/components/foodUi';
import { DatabaseProvider } from '@/data/DatabaseProvider';
import { LocalProfileProvider, useLocalProfile } from '@/navigation/LocalProfileProvider';
import { theme } from '@/theme/theme';

export function ProfileNavigator() {
  const { status, completed, reload } = useLocalProfile();
  if (status !== 'ready') return <SafeAreaView style={foodStyles.screen}><View style={foodStyles.status}>
    {status === 'loading' ? <ActivityIndicator accessibilityLabel="Opening your local profile" color={theme.colors.accent} /> : <>
      <Text accessibilityRole="alert" style={foodStyles.error}>Could not open your local profile. Your data has not been changed.</Text>
      <AppButton title="Try again" onPress={() => { void reload().catch(() => {}); }} />
    </>}
  </View></SafeAreaView>;
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Protected guard={completed}><Stack.Screen name="(tabs)" /></Stack.Protected>
    <Stack.Protected guard={!completed}><Stack.Screen name="onboarding" /></Stack.Protected>
  </Stack>;
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <DatabaseProvider>
        <LocalProfileProvider><ProfileNavigator /></LocalProfileProvider>
      </DatabaseProvider>
    </>
  );
}
