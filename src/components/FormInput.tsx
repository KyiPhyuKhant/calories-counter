import { useId } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { theme } from '@/theme/theme';

export function FormInput({ error, ...props }: TextInputProps & { error?: string }) {
  const accessoryId = useId();
  return <>
    <TextInput {...props} keyboardAppearance="light" placeholderTextColor={theme.colors.secondaryText}
      accessibilityHint={error || props.accessibilityHint} accessibilityState={{ disabled: props.editable === false }}
      inputAccessoryViewID={Platform.OS === 'ios' ? accessoryId : undefined} />
    {Platform.OS === 'ios' ? <InputAccessoryView nativeID={accessoryId} backgroundColor={theme.colors.surface}>
      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" accessibilityLabel="ကီးဘုတ်ပိတ်ရန်" onPress={Keyboard.dismiss} style={styles.done}>
          <Text style={styles.label}>ပြီးပါပြီ</Text>
        </Pressable>
      </View>
    </InputAccessoryView> : null}
  </>;
}

const styles = StyleSheet.create({
  toolbar: { borderTopWidth: 1, borderColor: theme.colors.border, alignItems: 'flex-end', paddingHorizontal: 16 },
  done: { minHeight: 44, minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  label: { color: theme.colors.accent, fontSize: 17, fontWeight: '600' },
});
