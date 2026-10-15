import { Stack } from 'expo-router';
import { stackOptions, tabRootOptions } from '@/navigation/stackOptions';

export const unstable_settings = { initialRouteName: 'index' };
export default function DiaryStack() {
  return <Stack screenOptions={stackOptions}>
    <Stack.Screen name="index" options={{ ...tabRootOptions, title: 'Diary' }} />
    <Stack.Screen name="select" options={{ title: 'Add food' }} />
    <Stack.Screen name="edit" options={{ title: 'Diary entry' }} />
    <Stack.Screen name="custom-food" options={{ title: 'Custom food' }} />
  </Stack>;
}
