import { Stack } from 'expo-router';
import { stackOptions, tabRootOptions } from '@/navigation/stackOptions';

export const unstable_settings = { initialRouteName: 'profile' };
export default function ProfileStack() {
  return <Stack screenOptions={stackOptions}>
    <Stack.Screen name="profile" options={{ ...tabRootOptions, title: 'Profile' }} />
    <Stack.Screen name="edit-profile" options={{ title: 'Edit profile' }} />
    <Stack.Screen name="goal-settings" options={{ title: 'Calorie goal' }} />
    <Stack.Screen name="history/index" options={{ title: 'History' }} />
    <Stack.Screen name="history/calories" options={{ title: 'Calorie history' }} />
    <Stack.Screen name="history/weight" options={{ title: 'Weight measurement' }} />
    <Stack.Screen name="settings" options={{ title: 'App settings' }} />
  </Stack>;
}
