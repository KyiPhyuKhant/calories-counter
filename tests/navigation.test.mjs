import assert from 'node:assert/strict';
import test from 'node:test';
import { goBack, goHome, homeDestinations } from '../src/navigation/navigation.ts';

function navigation(canGoBack) {
  const calls = [];
  return {
    calls,
    canGoBack: () => canGoBack,
    back: () => calls.push('back'),
    navigate: (href) => calls.push(href),
  };
}

test('Back returns to the previous screen when history exists', () => {
  const router = navigation(true);
  goBack(router);
  assert.deepEqual(router.calls, ['back']);
});

test('Back on a directly opened screen falls back to Home', () => {
  const router = navigation(false);
  goBack(router);
  assert.deepEqual(router.calls, ['/']);
});

test('Home navigates to the root tab rather than pushing another Home screen', () => {
  for (const hasHistory of [true, false]) {
    const router = navigation(hasHistory);
    goHome(router);
    assert.deepEqual(router.calls, ['/']);
  }
});

test('Home provides every main destination and preserves the selected date for diary and history', () => {
  const destinations = homeDestinations('2026-10-14');
  assert.deepEqual(destinations.map(({ key }) => key), ['diary', 'plans', 'foods', 'history', 'profile']);
  assert.deepEqual(destinations.map(({ href }) => href), [
    { pathname: '/diary', params: { date: '2026-10-14' } }, '/plans', '/foods',
    { pathname: '/history', params: { date: '2026-10-14' } }, '/profile',
  ]);
  assert.ok(destinations.every(({ label }) => label.length > 0));
});
