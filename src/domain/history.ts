import { localCalendarDate, shiftCalendarDate, validateCalendarDate } from './diary.ts';

export type HistoryPeriod = 'week' | 'month';
export interface DateRange { start: string; end: string }
export interface DailyConsumption { date: string; calories: number; entry_count: number }
export interface TargetChange { effective_date: string; target: number | null }
export interface WeightMeasurement { measured_date: string; weight_kg: number }
export interface HistoryDay {
  date: string; consumed: number | null; target: number | null;
  status: 'under' | 'at' | 'over' | 'no-log' | 'no-target' | 'future';
  weight: number | null; measurements: number;
}

export function historyRange(anchor: string, period: HistoryPeriod): DateRange {
  const start = validateCalendarDate(anchor);
  const end = new Date(start);
  if (period === 'week') {
    start.setDate(start.getDate() - (start.getDay() + 6) % 7);
    end.setTime(start.getTime()); end.setDate(end.getDate() + 6);
  } else if (period === 'month') {
    start.setDate(1); end.setMonth(end.getMonth() + 1, 0);
  } else throw new Error('Select a week or month.');
  return {
    start: localCalendarDate(new Date(Math.max(start.getTime(), new Date(1900, 0, 1, 12).getTime()))),
    end: localCalendarDate(new Date(Math.min(end.getTime(), new Date(2100, 11, 31, 12).getTime()))),
  };
}

export function shiftHistoryPeriod(anchor: string, period: HistoryPeriod, offset: number) {
  if (!Number.isInteger(offset)) throw new Error('Period offset must be a whole number.');
  const start = historyRange(anchor, period).start;
  if (period === 'week') return shiftCalendarDate(start, offset * 7);
  const date = validateCalendarDate(start); date.setMonth(date.getMonth() + offset, 1);
  return localCalendarDate(date);
}

export function validateWeight(date: string, weight: number, today = localCalendarDate()) {
  validateCalendarDate(date); validateCalendarDate(today);
  if (date > today) throw new Error('Choose today or an earlier measurement date.');
  if (!Number.isFinite(weight) || weight < 35 || weight > 300) throw new Error('Enter a weight from 35 to 300 kg.');
}

export function buildHistory(range: DateRange, today: string, consumption: DailyConsumption[], weights: WeightMeasurement[], targets: TargetChange[]) {
  validateCalendarDate(range.start); validateCalendarDate(range.end); validateCalendarDate(today);
  if (range.end < range.start) throw new Error('Invalid history range.');
  const calories = new Map<string, number>();
  for (const row of consumption) {
    validateCalendarDate(row.date);
    if (!Number.isFinite(row.calories) || row.calories < 0 || !Number.isInteger(row.entry_count) || row.entry_count < 1) throw new Error('Invalid logged calories.');
    calories.set(row.date, row.calories);
  }
  const measurements = new Map<string, number[]>();
  for (const row of weights) {
    validateCalendarDate(row.measured_date);
    if (!Number.isFinite(row.weight_kg) || row.weight_kg <= 0) throw new Error('Invalid recorded weight.');
    const values = measurements.get(row.measured_date) ?? []; values.push(row.weight_kg);
    measurements.set(row.measured_date, values);
  }
  const changes = [...targets].sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  for (const change of changes) {
    validateCalendarDate(change.effective_date);
    if (change.target !== null && (!Number.isFinite(change.target) || change.target <= 0)) throw new Error('Invalid historical target.');
  }
  const days: HistoryDay[] = [];
  let target: number | null = null;
  let index = 0;
  for (let date = range.start; ; date = shiftCalendarDate(date, 1)) {
    while (index < changes.length && changes[index].effective_date <= date) target = changes[index++].target;
    const consumed = calories.get(date) ?? null;
    const values = measurements.get(date) ?? [];
    days.push({ date, consumed, target,
      status: date > today ? 'future' : consumed === null ? 'no-log' : target === null ? 'no-target'
        : consumed < target ? 'under' : consumed > target ? 'over' : 'at',
      weight: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
      measurements: values.length,
    });
    if (date === range.end) break;
  }
  return { range, days, summary: summarizeHistory(days) };
}

export function summarizeHistory(days: HistoryDay[]) {
  const elapsed = days.filter((day) => day.status !== 'future');
  const logged = elapsed.filter((day) => day.consumed !== null);
  const knownTargets = elapsed.filter((day) => day.target !== null);
  const weighed = elapsed.filter((day) => day.weight !== null);
  const measurements = weighed.reduce((sum, day) => sum + day.measurements, 0);
  const totalCalories = logged.length ? logged.reduce((sum, day) => sum + day.consumed!, 0) : null;
  return {
    elapsedDays: elapsed.length, loggedDays: logged.length, totalCalories,
    averageCalories: totalCalories === null ? null : totalCalories / logged.length,
    targetDays: knownTargets.length,
    averageTarget: knownTargets.length ? knownTargets.reduce((sum, day) => sum + day.target!, 0) / knownTargets.length : null,
    underDays: elapsed.filter((day) => day.status === 'under').length,
    atDays: elapsed.filter((day) => day.status === 'at').length,
    overDays: elapsed.filter((day) => day.status === 'over').length,
    measurements,
    averageWeight: measurements ? weighed.reduce((sum, day) => sum + day.weight! * day.measurements, 0) / measurements : null,
    weightChange: weighed.length > 1 ? weighed[weighed.length - 1].weight! - weighed[0].weight! : null,
  };
}
