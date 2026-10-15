import { Stack } from 'expo-router';
import { stackOptions, tabRootOptions } from '@/navigation/stackOptions';

export const unstable_settings = { initialRouteName: 'index' };
export default function FoodsStack() {
  return <Stack screenOptions={stackOptions}>
    <Stack.Screen name="index" options={{ ...tabRootOptions, title: 'အစားအစာစာရင်း' }} />
    <Stack.Screen name="[id]" options={{ title: 'အစားအစာအချက်အလက်' }} />
    <Stack.Screen name="edit" options={{ title: 'အစားအစာပြင်ဆင်ရန်' }} />
  </Stack>;
}
