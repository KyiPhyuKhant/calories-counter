import type { ImageSourcePropType } from 'react-native';

// Metro requires literal asset imports. Register only matching, inspected local PNGs.
export const localFoodImages: Readonly<Record<string, ImageSourcePropType>> = {};

export function foodImage(filename: string | null | undefined) {
  return filename && Object.hasOwn(localFoodImages, filename) ? localFoodImages[filename] : undefined;
}
