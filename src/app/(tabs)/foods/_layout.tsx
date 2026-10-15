import { Stack } from 'expo-router';
import { stackOptions, tabRootOptions } from '@/navigation/stackOptions';

export const unstable_settings = { initialRouteName: 'index' };
export default function FoodsStack() {
  return <Stack screenOptions={stackOptions}>
    <Stack.Screen name="index" options={{ ...tabRootOptions, title: 'Foods' }} />
    <Stack.Screen name="[id]" options={{ title: 'Food details' }} />
    <Stack.Screen name="edit" options={{ title: 'Custom food' }} />
  </Stack>;
}
