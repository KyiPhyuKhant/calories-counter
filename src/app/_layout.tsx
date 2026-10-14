import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { NavigationButton } from '@/components/NavigationButton';
import { DatabaseProvider } from '@/data/DatabaseProvider';
import { theme } from '@/theme/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <DatabaseProvider>
        <Stack
          screenOptions={{
            headerShown: true,
            headerBackVisible: false,
            headerLeft: () => <NavigationButton destination="back" />,
            headerRight: () => <NavigationButton destination="home" />,
            headerTintColor: theme.colors.accent,
            headerStyle: { backgroundColor: theme.colors.background },
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false, title: 'Home' }} />
          <Stack.Screen name="profile" options={{ headerShown: true, title: 'Your profile', headerTintColor: theme.colors.accent }} />
          <Stack.Screen name="history/index" options={{ headerShown: true, title: 'History', headerTintColor: theme.colors.accent }} />
          <Stack.Screen name="history/weight" options={{ headerShown: true, title: 'Weight measurement', headerTintColor: theme.colors.accent }} />
          <Stack.Screen name="diary/index" options={{ headerShown: true, title: 'Food diary', headerTintColor: theme.colors.accent }} />
          <Stack.Screen name="diary/select" options={{ headerShown: true, title: 'Select food', headerTintColor: theme.colors.accent }} />
          <Stack.Screen name="diary/edit" options={{ headerShown: true, title: 'Diary entry', headerTintColor: theme.colors.accent }} />
          <Stack.Screen name="plans/index" options={{ headerShown: true, title: 'Meal plans', headerTintColor: theme.colors.accent }} />
          <Stack.Screen name="plans/select" options={{ headerShown: true, title: 'Select food', headerTintColor: theme.colors.accent }} />
          <Stack.Screen name="plans/edit" options={{ headerShown: true, title: 'Planned food', headerTintColor: theme.colors.accent }} />
          <Stack.Screen name="foods/index" options={{ headerShown: true, title: 'Food catalog', headerTintColor: theme.colors.accent }} />
          <Stack.Screen name="foods/[id]" options={{ headerShown: true, title: 'Food details', headerTintColor: theme.colors.accent }} />
          <Stack.Screen name="foods/edit" options={{ headerShown: true, title: 'Custom food', headerTintColor: theme.colors.accent }} />
        </Stack>
      </DatabaseProvider>
    </>
  );
}
