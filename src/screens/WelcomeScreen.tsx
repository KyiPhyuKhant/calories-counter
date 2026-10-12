import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme/theme';

export function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.introduction}>
          <Text style={styles.brand}>CALORIE COUNTER</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Welcome to a fresh start.
          </Text>
          <Text style={styles.subtitle}>
            A little awareness. A little balance. One day at a time.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.label}>
            <Text style={styles.labelText}>YOUR NEXT CHAPTER</Text>
          </View>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            Small steps matter.
          </Text>
          <Text style={styles.cardBody}>
            Make room for a healthier relationship with your everyday choices.
          </Text>
        </View>
        <Link href="/diary" asChild>
          <Pressable accessibilityRole="button" style={styles.profileButton}>
            <Text style={styles.profileButtonText}>Open food diary</Text>
          </Pressable>
        </Link>
        <Link href="/profile" asChild>
          <Pressable accessibilityRole="button" style={styles.profileButton}>
            <Text style={styles.profileButtonText}>Set up your profile</Text>
          </Pressable>
        </Link>
        <Link href="/foods" asChild>
          <Pressable accessibilityRole="button" style={styles.profileButton}>
            <Text style={styles.profileButtonText}>Browse foods</Text>
          </Pressable>
        </Link>
        <Text style={styles.footer}>A fresh perspective, every day.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  profileButton: { backgroundColor: theme.colors.accent, borderRadius: 8, padding: 16, minHeight: 48, alignItems: 'center' },
  profileButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    padding: theme.spacing.large,
    gap: theme.spacing.extraLarge,
  },
  introduction: {
    gap: theme.spacing.medium,
  },
  brand: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 22,
  },
  title: {
    color: theme.colors.text,
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 44,
  },
  subtitle: {
    color: theme.colors.secondaryText,
    fontSize: 18,
    lineHeight: 28,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: theme.spacing.large,
    gap: theme.spacing.medium,
  },
  label: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.accentSurface,
    borderRadius: 4,
    paddingHorizontal: theme.spacing.small,
    paddingVertical: 4,
  },
  labelText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
  },
  cardBody: {
    color: theme.colors.secondaryText,
    fontSize: 17,
    lineHeight: 26,
  },
  footer: {
    color: theme.colors.secondaryText,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
});
