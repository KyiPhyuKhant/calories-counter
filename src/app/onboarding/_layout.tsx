import { Stack } from 'expo-router';
import { OnboardingProvider } from '@/navigation/OnboardingProvider';
import { stackOptions } from '@/navigation/stackOptions';

export const unstable_settings = { initialRouteName: 'index' };

export default function OnboardingLayout() {
  return <OnboardingProvider><Stack screenOptions={{ ...stackOptions, headerBackVisible: true, headerBackButtonDisplayMode: 'minimal', headerLeft: undefined, headerRight: () => null }}>
    <Stack.Screen name="index" options={{ headerShown: false, title: 'Welcome' }} />
    <Stack.Screen name="profile" options={{ title: 'Profile setup' }} />
    <Stack.Screen name="activity" options={{ title: 'Activity & goal' }} />
    <Stack.Screen name="target" options={{ title: 'Daily calorie target', gestureEnabled: false }} />
  </Stack></OnboardingProvider>;
}
