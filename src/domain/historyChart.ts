import type { HistoryDay } from './history.ts';

export function historyChartModel(days: HistoryDay[], kind: 'weight' | 'calories', width: number) {
  const values = days.flatMap((day) => day.status === 'future' ? [] : kind === 'weight'
    ? day.weight === null ? [] : [day.weight]
    : [day.consumed, day.target].filter((value): value is number => value !== null));
  const minimum = values.length ? Math.min(...values) : 0;
  const maximum = values.length ? Math.max(...values) : 0;
  const low = kind === 'weight' ? Math.max(0, minimum - 0.5) : 0;
  const high = kind === 'weight' ? maximum + 0.5 : Math.max(500, Math.ceil(maximum / 500) * 500);
  const step = Math.max(1, width - 60) / Math.max(1, days.length);
  return {
    low, high, hasData: values.length > 0, ticks: [high, (low + high) / 2, low], step,
    x: (index: number) => 48 + step * (index + 0.5),
    y: (value: number) => 16 + (high - value) / (high - low) * 180,
  };
}

export function chartConnections(days: HistoryDay[], field: 'weight' | 'target') {
  return days.flatMap((day, index) => {
    const previous = days[index - 1];
    return previous && previous.status !== 'future' && day.status !== 'future'
      && previous[field] !== null && day[field] !== null ? [{ from: index - 1, to: index }] : [];
  });
}
