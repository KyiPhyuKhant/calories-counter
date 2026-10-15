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
    { key: 'diary', label: 'စားသုံးမှုမှတ်တမ်း', href: { pathname: '/diary', params: { date } } },
    { key: 'plans', label: 'စားသောက်အစီအစဉ်', href: '/plans' },
    { key: 'foods', label: 'အစားအစာစာရင်း', href: '/foods' },
    { key: 'history', label: 'ကိုယ်အလေးချိန်နှင့် ကယ်လိုရီမှတ်တမ်း', href: { pathname: '/history', params: { date } } },
    { key: 'profile', label: 'ကိုယ်ရေးအချက်အလက်နှင့် ရည်မှန်းချက်', href: '/profile' },
  ] as const satisfies readonly { key: string; label: string; href: Href }[];
}
