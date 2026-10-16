import { useRouter, type Href } from 'expo-router';
import { ChevronRight, ChartColumn, Pencil, Settings, Target, type LucideIcon } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { calculateCalorieGoal } from '@/domain/calorieGoal';
import { useLocalProfile } from '@/navigation/LocalProfileProvider';
import { completedProfileInput } from '@/navigation/profileSetup';
import { theme, uiStyles } from '@/theme/theme';

const links: { title: string; href: Href; icon: LucideIcon }[] = [
  { title: 'Edit profile', href: '/edit-profile', icon: Pencil },
  { title: 'Calorie goal settings', href: '/goal-settings', icon: Target },
  { title: 'Weight and calorie history', href: '/history', icon: ChartColumn },
  { title: 'App settings', href: '/settings', icon: Settings },
];

export function ProfileOverviewScreen() {
  const { profile } = useLocalProfile();
  const router = useRouter();
  const input = completedProfileInput(profile);
  const estimate = input ? calculateCalorieGoal(input) : null;
  return <SafeAreaView edges={['left', 'right']} style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
    <AppHeader title="Profile" subtitle="Your goals, measurements, and history." />
    {input && estimate ? <AppCard tinted>
      <Text style={styles.label}>Daily calorie target</Text><Text style={styles.metric}>{estimate.target} kcal</Text>
      <Text style={styles.detail}>Estimated from your profile{input.manual_calorie_target !== null ? ', manually adjusted' : ''}.</Text>
      <Text style={styles.body}>{input.current_weight_kg} kg current · {input.target_weight_kg} kg target</Text>
    </AppCard> : null}
    {links.map(({ title, href, icon: Icon }) => <Pressable key={title} accessibilityRole="button" accessibilityLabel={title} onPress={() => router.push(href)} style={styles.link}>
      <Icon size={22} color={theme.colors.accent} /><Text style={[styles.label, styles.grow]}>{title}</Text><ChevronRight size={20} color={theme.colors.secondaryText} />
    </Pressable>)}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: uiStyles.page,
  link: { minHeight: 56, flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderColor: theme.colors.border },
  grow: { flex: 1 }, label: { ...theme.typography.label, color: theme.colors.text },
  metric: { ...theme.typography.metric, color: theme.colors.text },
  body: { ...theme.typography.body, color: theme.colors.text }, detail: { ...theme.typography.caption, color: theme.colors.secondaryText },
});
