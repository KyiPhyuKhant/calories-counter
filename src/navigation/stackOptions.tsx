import { NavigationButton } from '@/components/NavigationButton';
import { theme } from '@/theme/theme';

export const stackOptions = {
  headerTintColor: theme.colors.accent,
  headerTitleStyle: { color: theme.colors.text, fontSize: 17, fontWeight: '600' as const },
  headerStyle: { backgroundColor: theme.colors.background },
  contentStyle: { backgroundColor: theme.colors.background },
  headerBackVisible: false,
  headerLeft: () => <NavigationButton destination="back" />,
  headerRight: () => <NavigationButton destination="home" />,
};

export const tabRootOptions = { headerLeft: () => null, headerRight: () => null };
