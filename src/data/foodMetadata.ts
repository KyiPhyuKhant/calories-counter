import type { Food, FoodInput } from '../domain/food.ts';
import type { SqlValue } from './database.ts';

export const metadataFields = ['native_name', 'aliases', 'category', 'nutrition_source', 'nutrition_status', 'image'] as const;
export const metadataColumns = metadataFields.join(', ');

export function metadataValues(input: FoodInput): SqlValue[] {
  return [input.native_name?.normalize('NFKC').trim() || null,
    JSON.stringify([...new Set((input.aliases ?? []).map((name) => name.normalize('NFKC').trim()))]),
    input.category ?? null, input.nutrition_source?.trim() || null,
    input.nutrition_status ?? (input.calories === null ? 'unverified' : 'user_entered'), input.image ?? null];
}

export function metadataUpdateValues(input: FoodInput): SqlValue[] {
  return metadataValues(input).flatMap((value, index) => [input[metadataFields[index]] !== undefined ? 1 : 0, value]);
}

export function decodeFood(row: Omit<Food, 'aliases'> & { aliases?: string | string[] }): Food {
  const aliases: unknown = typeof row.aliases === 'string' ? JSON.parse(row.aliases) : row.aliases ?? [];
  if (!Array.isArray(aliases) || aliases.some((alias) => typeof alias !== 'string')) throw new Error('Invalid stored food aliases.');
  return { ...row, aliases };
}
