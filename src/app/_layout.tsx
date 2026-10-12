import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { DatabaseProvider } from '@/data/DatabaseProvider';
import { theme } from '@/theme/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <DatabaseProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen name="profile" options={{ headerShown: true, title: 'Your profile', headerTintColor: theme.colors.accent }} />
        </Stack>
      </DatabaseProvider>
    </>
  );
}
