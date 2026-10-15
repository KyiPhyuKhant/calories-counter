import { Stack } from 'expo-router';
import { stackOptions, tabRootOptions } from '@/navigation/stackOptions';

export const unstable_settings = { initialRouteName: 'index' };
export default function DiaryStack() {
  return <Stack screenOptions={stackOptions}>
    <Stack.Screen name="index" options={{ ...tabRootOptions, title: 'စားသုံးမှုမှတ်တမ်း' }} />
    <Stack.Screen name="select" options={{ title: 'အစားအစာထည့်ရန်' }} />
    <Stack.Screen name="edit" options={{ title: 'စားသုံးမှု ပြင်ဆင်ရန်' }} />
    <Stack.Screen name="custom-food" options={{ title: 'အစားအစာပြင်ဆင်ရန်' }} />
  </Stack>;
}
