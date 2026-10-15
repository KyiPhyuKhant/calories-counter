export function progressRingMetrics(progress: number, size = 216, strokeWidth = 12) {
  const fraction = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  return { fraction, radius, circumference, offset: circumference * (1 - fraction) };
}
