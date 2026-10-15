import { Stack } from 'expo-router';
import { stackOptions, tabRootOptions } from '@/navigation/stackOptions';

export const unstable_settings = { initialRouteName: 'index' };
export default function PlanStack() {
  return <Stack screenOptions={stackOptions}>
    <Stack.Screen name="index" options={{ ...tabRootOptions, title: 'စားသောက်အစီအစဉ်' }} />
    <Stack.Screen name="select" options={{ title: 'အစားအစာစီစဉ်ရန်' }} />
    <Stack.Screen name="edit" options={{ title: 'အစားအစာအစီအစဉ်' }} />
    <Stack.Screen name="custom-food" options={{ title: 'အစားအစာပြင်ဆင်ရန်' }} />
  </Stack>;
}
