import type { Href } from 'expo-router';

type Navigation = {
  canGoBack: () => boolean;
  back: () => void;
  navigate: (href: Href) => void;
};

export function goHome(router: Navigation) {
  router.navigate('/');
}

export function goBack(router: Navigation) {
  if (router.canGoBack()) router.back();
  else goHome(router);
}

export function homeDestinations(date: string) {
  return [
    { key: 'diary', label: 'Food diary', href: { pathname: '/diary', params: { date } } },
    { key: 'plans', label: 'Meal plans', href: '/plans' },
    { key: 'foods', label: 'Food catalog', href: '/foods' },
    { key: 'history', label: 'Weight and calorie history', href: { pathname: '/history', params: { date } } },
    { key: 'profile', label: 'Profile and calorie goal', href: '/profile' },
  ] as const satisfies readonly { key: string; label: string; href: Href }[];
}
