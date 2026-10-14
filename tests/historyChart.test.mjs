import assert from 'node:assert/strict';
import test from 'node:test';
import { historyChartModel, chartConnections } from '../src/domain/historyChart.ts';

const day = (date, values = {}) => ({ date, weight: null, measurements: 0, consumed: null, target: null, status: 'no-log', ...values });

test('calorie graph includes targets, preserves zero logs, and excludes future values', () => {
  const days = [day('2026-10-12', { consumed: 0, target: 2000, status: 'under' }), day('2026-10-13', { consumed: 2600, target: 2200, status: 'over' }), day('2026-10-14', { consumed: 9000, target: 10000, status: 'future' })];
  const model = historyChartModel(days, 'calories', 300);
  assert.equal(model.low, 0); assert.equal(model.high, 3000); assert.equal(model.y(0), 196);
  assert.ok(model.y(2600) < model.y(2200)); assert.equal(model.hasData, true);
  assert.deepEqual(chartConnections(days, 'target'), [{ from: 0, to: 1 }]);
});

test('weight graph never joins across missing days or future measurements', () => {
  const days = [day('2026-10-12', { weight: 80 }), day('2026-10-13'), day('2026-10-14', { weight: 79 }), day('2026-10-15', { weight: 78.5 }), day('2026-10-16', { weight: 78, status: 'future' })];
  assert.deepEqual(chartConnections(days, 'weight'), [{ from: 2, to: 3 }]);
  const model = historyChartModel(days, 'weight', 300);
  assert.equal(model.low, 78); assert.equal(model.high, 80.5);
});

test('empty and constant series have finite scales on narrow and wide layouts', () => {
  for (const width of [160, 280, 512]) for (const kind of ['weight', 'calories']) {
    const empty = historyChartModel([], kind, width);
    assert.equal(empty.hasData, false); assert.ok(Number.isFinite(empty.y(0)));
    const days = Array.from({ length: 31 }, (_, index) => day(`2026-10-${String(index + 1).padStart(2, '0')}`, { weight: 80, consumed: 0 }));
    const model = historyChartModel(days, kind, width);
    assert.ok(model.high > model.low); assert.ok(model.x(0) >= 48); assert.ok(model.x(30) < width - 12);
    assert.ok(Number.isFinite(model.y(kind === 'weight' ? 80 : 0)));
  }
});

test('known target without consumption is charted without creating a calorie log', () => {
  const days = [day('2026-10-12', { target: 2000 })];
  assert.equal(historyChartModel(days, 'calories', 300).hasData, true);
  assert.equal(days[0].consumed, null);
  assert.equal(historyChartModel(days, 'weight', 300).hasData, false);
});
