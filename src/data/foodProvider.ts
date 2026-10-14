import type { FoodInput } from '../domain/food.ts';

export interface ProviderFood extends FoodInput {
  externalId: string;
  sourceUrl?: string;
  dataType?: string;
}

export interface FoodProvider {
  readonly id: string;
  search(query: string, options?: { signal?: AbortSignal }): Promise<ProviderFood[]>;
  get(externalId: string, options?: { signal?: AbortSignal }): Promise<ProviderFood | null>;
}

export class FoodProviderError extends Error {
  code: 'configuration' | 'timeout' | 'rate-limit' | 'network' | 'authorization' | 'response' | 'cancelled';
  retryAfterSeconds?: number;
  constructor(code: FoodProviderError['code'], message: string, retryAfterSeconds?: number) {
    super(message); this.name = 'FoodProviderError'; this.code = code; this.retryAfterSeconds = retryAfterSeconds;
  }
}
