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
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    tabBarHideOnKeyboard: true,
  }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarAccessibilityLabel: 'Home tab', tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
    <Tabs.Screen name="diary" options={{ title: 'Diary', tabBarAccessibilityLabel: 'Diary tab', tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} /> }} />
    <Tabs.Screen name="foods" options={{ title: 'Foods', tabBarAccessibilityLabel: 'Foods tab', tabBarIcon: ({ color, size }) => <Search color={color} size={size} /> }} />
    <Tabs.Screen name="plans" options={{ title: 'Plan', tabBarAccessibilityLabel: 'Plan tab', tabBarIcon: ({ color, size }) => <CalendarClock color={color} size={size} /> }} />
    <Tabs.Screen name="(profile)" options={{ title: 'Profile', tabBarAccessibilityLabel: 'Profile tab', tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
  </Tabs>;
}
