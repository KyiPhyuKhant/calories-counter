import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { caloriesLabel, DiaryIconButton } from '@/components/diaryUi';
import { foodStyles } from '@/components/foodUi';
import type { HistoryDay } from '@/domain/history';
import { chartConnections, historyChartModel } from '@/domain/historyChart';
import { theme } from '@/theme/theme';

const colors = { under: theme.colors.accent, at: theme.colors.planning, over: theme.colors.warning, 'no-target': theme.colors.secondaryText, 'no-log': theme.colors.secondaryText, future: theme.colors.secondaryText };
const labels = { under: 'Under target', at: 'At target', over: 'Over target', 'no-target': 'Target unknown', 'no-log': 'No food logged', future: 'Future date' };
const kg = (value: number) => `${Number(value.toFixed(2))} kg`;

export function HistoryChart({ days, kind }: { days: HistoryDay[]; kind: 'weight' | 'calories' }) {
  const [width, setWidth] = useState(300);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const model = historyChartModel(days, kind, width);
  const recorded = days.map((day, index) => ({ day, index })).filter(({ day }) => day.status !== 'future' && (kind === 'weight' ? day.weight !== null : day.consumed !== null));
  const stored = days.findIndex((day) => day.date === selectedDate);
  const elapsed = days.map((day, index) => ({ day, index })).filter(({ day }) => day.status !== 'future');
  const selectedIndex = stored >= 0 ? stored : recorded[recorded.length - 1]?.index ?? elapsed[elapsed.length - 1]?.index ?? 0;
  const selected = days[selectedIndex];
  if (!selected) return null;
  const describeDay = (day: HistoryDay) => `${day.date}: ${day.status === 'future' ? 'Future date' : kind === 'weight'
    ? day.weight === null ? 'No measurement' : kg(day.weight)
    : `${day.consumed === null ? 'No food logged' : `${caloriesLabel(day.consumed)} consumed`}, ${day.target === null ? 'target unknown' : `${caloriesLabel(day.target)} target`}, ${labels[day.status]}`}`;
  return <View style={ui.container} onLayout={(event) => setWidth(Math.max(160, event.nativeEvent.layout.width))}>
    <Text style={foodStyles.detail}>{kind === 'weight' ? 'Daily mean weight (kg)' : 'Daily calories (kcal)'}</Text>
    {kind === 'calories' ? <View style={ui.legend}>
      <View style={ui.legendItem}><View style={ui.swatch} /><Text style={foodStyles.detail}>Consumed</Text></View>
      <View style={ui.legendItem}><View style={ui.targetSwatch} /><Text style={foodStyles.detail}>Target</Text></View>
    </View> : null}
    <Svg width={width} height={228} accessible accessibilityRole="image"
      accessibilityLabel={`${kind === 'weight' ? 'Weight trend' : 'Calorie consumption and target'} graph. ${days.map(describeDay).join('. ')}`}>
      {model.ticks.map((tick) => <G key={tick}>
        <Line x1={48} x2={width - 12} y1={model.y(tick)} y2={model.y(tick)} stroke={theme.colors.border} />
        {model.hasData ? <SvgText x={40} y={model.y(tick) + 4} fontSize={11} textAnchor="end" fill={theme.colors.secondaryText}>{kind === 'weight' ? tick.toFixed(1) : Math.round(tick)}</SvgText> : null}
      </G>)}
      <Line x1={model.x(selectedIndex)} x2={model.x(selectedIndex)} y1={16} y2={196} stroke={theme.colors.border} strokeDasharray="3 4" />
      {kind === 'weight' ? chartConnections(days, 'weight').map(({ from, to }) => <Line key={to}
        x1={model.x(from)} y1={model.y(days[from].weight!)} x2={model.x(to)} y2={model.y(days[to].weight!)} stroke={theme.colors.accent} strokeWidth={2} />) : null}
      {days.map((day, index) => {
        const x = model.x(index);
        const value = kind === 'weight' ? day.weight : day.consumed;
        return <G key={day.date}>
          {day.status !== 'future' && value !== null ? kind === 'weight'
            ? <Circle cx={x} cy={model.y(value)} r={index === selectedIndex ? 6 : 4} fill={theme.colors.accent} />
            : value === 0 ? <Line x1={x - model.step * 0.25} x2={x + model.step * 0.25} y1={196} y2={196} stroke={colors[day.status]} strokeWidth={3} />
              : <Rect x={x - model.step * 0.28} y={model.y(value)} width={model.step * 0.56} height={196 - model.y(value)} rx={2} fill={colors[day.status]} /> : null}
          {kind === 'calories' && day.status !== 'future' && day.target !== null ? <Circle cx={x} cy={model.y(day.target)} r={3} fill={colors.at} /> : null}
          {index === 0 || index === days.length - 1 || index === Math.floor(days.length / 2)
            ? <SvgText x={x} y={218} fill={theme.colors.secondaryText} fontSize={11} textAnchor="middle">{day.date.slice(5).replace('-', '/')}</SvgText> : null}
        </G>;
      })}
      {kind === 'calories' ? chartConnections(days, 'target').map(({ from, to }) => <G key={to}>
        <Line x1={model.x(from)} y1={model.y(days[from].target!)} x2={model.x(to)} y2={model.y(days[from].target!)} stroke={colors.at} strokeWidth={2} strokeDasharray="4 3" />
        <Line x1={model.x(to)} y1={model.y(days[from].target!)} x2={model.x(to)} y2={model.y(days[to].target!)} stroke={colors.at} strokeWidth={2} />
      </G>) : null}
      {days.map((day, index) => <Rect key={`select:${day.date}`} x={model.x(index) - model.step / 2} y={0}
        width={model.step} height={228} fill="transparent" onPress={() => setSelectedDate(day.date)} />)}
    </Svg>
    {!model.hasData ? <Text style={foodStyles.detail}>{kind === 'weight' ? 'No weight measurements this period.' : 'No calorie logs or targets this period.'}</Text> : null}
    <View style={ui.selection}>
      <DiaryIconButton icon={ChevronLeft} label="Previous graph day" disabled={selectedIndex === 0} onPress={() => setSelectedDate(days[selectedIndex - 1].date)} />
      <View style={ui.readout}>
        <Text style={foodStyles.label}>{selected.date}</Text>
        <Text accessibilityLiveRegion="polite" style={foodStyles.detail}>{selected.status === 'future' ? 'Future date' : kind === 'weight'
          ? selected.weight === null ? 'No measurement' : `${kg(selected.weight)} (${selected.measurements} measurement${selected.measurements === 1 ? '' : 's'})`
          : `${selected.consumed === null ? 'No food logged' : caloriesLabel(selected.consumed)} / ${selected.target === null ? 'target unknown' : `${caloriesLabel(selected.target)} target`}`}</Text>
        {kind === 'calories' && selected.status !== 'future' ? <Text style={[foodStyles.detail, { color: colors[selected.status] }]}>{labels[selected.status]}</Text> : null}
      </View>
      <DiaryIconButton icon={ChevronRight} label="Next graph day" disabled={selectedIndex === days.length - 1} onPress={() => setSelectedDate(days[selectedIndex + 1].date)} />
    </View>
  </View>;
}

const ui = StyleSheet.create({
  container: { width: '100%', gap: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 12, height: 12, borderRadius: 2, backgroundColor: theme.colors.accent },
  targetSwatch: { width: 20, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.at },
  selection: { flexDirection: 'row', alignItems: 'center', gap: 4, borderTopWidth: 1, borderColor: theme.colors.border, paddingTop: 8 },
  readout: { flex: 1, gap: 4, alignItems: 'center' },
});
