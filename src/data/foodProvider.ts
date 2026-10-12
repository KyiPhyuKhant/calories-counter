import type { FoodInput } from '../domain/food.ts';

export interface ProviderFood extends FoodInput {
  externalId: string;
}

// Contract only: no network implementation or provider credentials in this stage.
export interface FoodProvider {
  readonly id: string;
  search(query: string, options?: { signal?: AbortSignal }): Promise<ProviderFood[]>;
  get(externalId: string, options?: { signal?: AbortSignal }): Promise<ProviderFood | null>;
}
