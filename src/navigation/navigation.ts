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
