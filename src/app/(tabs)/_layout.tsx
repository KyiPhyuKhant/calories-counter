import { Tabs } from 'expo-router';
import { BookOpen, CalendarClock, House, Search, UserRound } from 'lucide-react-native';
import { theme } from '@/theme/theme';

export const unstable_settings = { initialRouteName: 'index' };

export default function MainTabs() {
  return <Tabs initialRouteName="index" backBehavior="initialRoute" screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: theme.colors.accent,
    tabBarInactiveTintColor: theme.colors.secondaryText,
    tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
    tabBarLabelStyle: { fontSize: 11, lineHeight: 20, fontWeight: '600' },
    tabBarHideOnKeyboard: true,
  }}>
    <Tabs.Screen name="index" options={{ title: 'ပင်မ', tabBarAccessibilityLabel: 'ပင်မစာမျက်နှာ', tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
    <Tabs.Screen name="diary" options={{ title: 'မှတ်တမ်း', tabBarAccessibilityLabel: 'စားသုံးမှုမှတ်တမ်း', tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} /> }} />
    <Tabs.Screen name="foods" options={{ title: 'အစားအစာ', tabBarAccessibilityLabel: 'အစားအစာစာရင်း', tabBarIcon: ({ color, size }) => <Search color={color} size={size} /> }} />
    <Tabs.Screen name="plans" options={{ title: 'အစီအစဉ်', tabBarActiveTintColor: theme.colors.mealPlan, tabBarAccessibilityLabel: 'စားသောက်အစီအစဉ်', tabBarIcon: ({ color, size }) => <CalendarClock color={color} size={size} /> }} />
    <Tabs.Screen name="(profile)" options={{ title: 'Profile', href: '/profile', tabBarAccessibilityLabel: 'Profile', tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
  </Tabs>;
}
