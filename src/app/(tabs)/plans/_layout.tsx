import { Stack } from 'expo-router';
import { stackOptions, tabRootOptions } from '@/navigation/stackOptions';

export const unstable_settings = { initialRouteName: 'index' };
export default function PlanStack() {
  return <Stack screenOptions={stackOptions}>
    <Stack.Screen name="index" options={{ ...tabRootOptions, title: 'Plan' }} />
    <Stack.Screen name="select" options={{ title: 'Plan food' }} />
    <Stack.Screen name="edit" options={{ title: 'Planned food' }} />
    <Stack.Screen name="custom-food" options={{ title: 'Custom food' }} />
  </Stack>;
}
