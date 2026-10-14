import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import type { HistoryDay } from '@/domain/history';
import { foodStyles } from '@/components/foodUi';
import { theme } from '@/theme/theme';

export function WeightChart({ days }: { days: HistoryDay[] }) {
  const [width, setWidth] = useState(280);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const points = days.flatMap((day, index) => day.weight === null ? [] : [{ ...day, index }]);
  if (!points.length) return <Text style={foodStyles.body}>No weight measurements this period.</Text>;
  const minimum = Math.min(...points.map((point) => point.weight!));
  const maximum = Math.max(...points.map((point) => point.weight!));
  const low = Math.max(0, minimum - 0.5); const high = maximum + 0.5;
  const selected = points.find((point) => point.date === selectedDate) ?? points[points.length - 1];
  const x = (index: number) => 12 + index / Math.max(1, days.length - 1) * Math.max(1, width - 24);
  const y = (weight: number) => 12 + (high - weight) / (high - low) * 136;
  return <View style={chartStyles.container} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
    <Text style={foodStyles.detail}>Daily mean weight (kg)</Text>
    <Text style={foodStyles.detail}>{high.toFixed(1)} kg</Text>
    <Svg width={width} height={160} accessible accessibilityRole="image"
      accessibilityLabel={`Daily mean weight chart. ${points.map((point) => `${point.date}: ${Number(point.weight!.toFixed(2))} kilograms`).join('. ')}`}>
      {[12, 80, 148].map((position) => <Line key={position} x1={0} x2={width} y1={position} y2={position} stroke={theme.colors.border} />)}
      {points.map((point) => <Circle key={point.date} cx={x(point.index)} cy={y(point.weight!)} r={point.date === selected.date ? 7 : 5}
        fill={theme.colors.accent} onPress={() => setSelectedDate(point.date)} />)}
    </Svg>
    <Text style={foodStyles.detail}>{low.toFixed(1)} kg</Text>
    <View style={chartStyles.axis}><Text style={foodStyles.detail}>{days[0].date}</Text><Text style={foodStyles.detail}>{days[days.length - 1].date}</Text></View>
    <Text accessibilityLiveRegion="polite" style={foodStyles.body}>{selected.date}: {Number(selected.weight!.toFixed(2))} kg ({selected.measurements} measurement{selected.measurements === 1 ? '' : 's'})</Text>
  </View>;
}

const chartStyles = StyleSheet.create({
  container: { gap: 4, width: '100%' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
});
