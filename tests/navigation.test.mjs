import assert from 'node:assert/strict';
import test from 'node:test';
import { goBack, goHome } from '../src/navigation/navigation.ts';

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
