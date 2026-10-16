import { Image } from 'react-native';

export function BrandLogo({ size = 48 }: { size?: number }) {
  return <Image source={require('../../assets/healthy-bowl-logo.png')} resizeMode="contain"
    accessibilityRole="image" accessibilityLabel="CalNote logo"
    style={{ width: size, height: size, maxWidth: '100%', aspectRatio: 1 }} />;
}
