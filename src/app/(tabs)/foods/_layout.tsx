import { Stack } from 'expo-router';
import { stackOptions, tabRootOptions } from '@/navigation/stackOptions';

export const unstable_settings = { initialRouteName: 'index' };
export default function FoodsStack() {
  return <Stack screenOptions={stackOptions}>
    <Stack.Screen name="index" options={{ ...tabRootOptions, title: 'အစားအသောက် စာရင်း' }} />
    <Stack.Screen name="[id]" options={{ title: 'အချက်အလက်' }} />
    <Stack.Screen name="edit" options={{ title: 'ပြင်ဆင်ရန်' }} />
  </Stack>;
}
