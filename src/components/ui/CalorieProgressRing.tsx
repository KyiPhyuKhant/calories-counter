import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { progressRingMetrics } from './progressRing';
import { theme } from '@/theme/theme';

export function CalorieProgressRing({ progress, value, caption, accessibilityLabel, overTarget = false }: {
  progress: number; value: string; caption: string; accessibilityLabel: string; overTarget?: boolean;
}) {
  const { fraction, radius, circumference, offset } = progressRingMetrics(progress);
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel}
    accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100), text: `${value}, ${caption}` }} style={styles.ring}>
    <Svg width="100%" height="100%" viewBox="0 0 216 216" accessible={false}>
      <Circle cx={108} cy={108} r={radius} fill="none" stroke={theme.colors.border} strokeWidth={12} />
      {fraction > 0 ? <Circle cx={108} cy={108} r={radius} fill="none" stroke={overTarget ? theme.colors.warning : theme.colors.primary}
        strokeWidth={12} strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={offset} rotation={-90} origin="108, 108" /> : null}
    </Svg>
    <View pointerEvents="none" style={styles.value}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={styles.number}>{value}</Text>
      <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.caption}>{caption}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  ring: { width: 216, maxWidth: '100%', aspectRatio: 1, alignSelf: 'center' },
  value: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 4 },
  number: { ...theme.typography.metric, color: theme.colors.text, textAlign: 'center', width: '100%' },
  caption: { ...theme.typography.caption, color: theme.colors.secondaryText, textAlign: 'center', width: '100%' },
});
