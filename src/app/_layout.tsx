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
    {status === 'loading' ? <ActivityIndicator accessibilityLabel="ကိုယ်ရေးအချက်အလက်ကို ဖတ်ယူနေသည်" color={theme.colors.accent} /> : <>
      <Text accessibilityRole="alert" style={foodStyles.error}>ကိုယ်ရေးအချက်အလက်ကို ဖတ်ယူ၍မရပါ။ သိမ်းထားသော အချက်အလက်များကို မပြောင်းထားပါ။</Text>
      <AppButton title="ပြန်လည်ကြိုးစားရန်" onPress={() => { void reload().catch(() => {}); }} />
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
