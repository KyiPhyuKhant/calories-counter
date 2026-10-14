import { normalizeFood } from '../domain/food.ts';
import { FoodProviderError, type FoodProvider, type ProviderFood } from './foodProvider.ts';

export const usdaDataTypes = ['Foundation', 'SR Legacy', 'Survey (FNDDS)'];
export const usdaFoodUrl = (id: string) => `https://fdc.nal.usda.gov/food-details/${encodeURIComponent(id)}/nutrients`;
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

// USDA's supported data types report nutrients per 100 g. Never infer missing energy or density.
export function mapUsdaFood(value: unknown): ProviderFood | null {
  const food = object(value);
  if (!Number.isSafeInteger(food.fdcId) || (food.fdcId as number) <= 0 || typeof food.description !== 'string' || !food.description.trim() || !usdaDataTypes.includes(String(food.dataType))) return null;
  if (!Array.isArray(food.foodNutrients)) return null;
  function nutrient(id: number, unit: string) {
    for (const value of food.foodNutrients as unknown[]) {
      const row = object(value); const metadata = object(row.nutrient);
      if ((metadata.id ?? row.nutrientId) === id && String(metadata.unitName ?? row.unitName).toUpperCase() === unit) {
        const result = number(row.amount ?? row.value);
        if (result !== null) return result;
      }
    }
    return null;
  }
  const energy = nutrient(1008, 'KCAL') ?? nutrient(2048, 'KCAL') ?? nutrient(2047, 'KCAL');
  if (energy === null) return null;
  const portions = Array.isArray(food.foodPortions) ? food.foodPortions.map(object) : [];
  const portion = portions.find((item) => { const grams = number(item.gramWeight); return grams !== null && grams >= 0.001 && grams <= 100000; });
  const serving = portion ? portion.gramWeight as number : 100;
  const ratio = serving / 100;
  const scale = (value: number | null) => value === null ? null : value * ratio;
  const id = String(food.fdcId); const url = usdaFoodUrl(id);
  const unit = portion ? object(portion.measureUnit).name : null;
  const portionLabel = portion ? [portion.amount, unit === 'undetermined' ? null : unit, portion.modifier, portion.portionDescription].filter((value) => typeof value === 'string' || typeof value === 'number').join(' ') : '';
  const notes = [`Source: USDA FoodData Central (${food.dataType}); FDC ID ${id}.`, url,
    portionLabel ? `USDA portion: ${portionLabel} (${serving} g).` : 'Nutrition basis: 100 g; no supported portion weight provided.',
    food.description.length > 120 ? `Full description: ${food.description}` : '',
  ].filter(Boolean).join('\n').slice(0, 2000);
  try {
    return { ...normalizeFood({ name: food.description.trim().slice(0, 120), calories: energy * ratio,
      serving_amount: serving, serving_unit: 'g', protein: scale(nutrient(1003, 'G')),
      carbohydrates: scale(nutrient(1005, 'G')), fat: scale(nutrient(1004, 'G')), notes }),
    externalId: id, sourceUrl: url, dataType: String(food.dataType) };
  } catch { return null; }
}

export function createUsdaFoodProvider({ baseUrl, fetcher = fetch, timeoutMs = 12000, allowInsecureHttp = false }: {
  baseUrl: string; fetcher?: typeof fetch; timeoutMs?: number; allowInsecureHttp?: boolean;
}): FoodProvider {
  let base: URL;
  try { base = new URL(baseUrl); } catch { throw new FoodProviderError('configuration', 'USDA online search is not configured.'); }
  if ((base.protocol !== 'https:' && !(allowInsecureHttp && base.protocol === 'http:')) || base.username || base.password || base.search || base.hash || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new FoodProviderError('configuration', 'Configure a secure food API URL without credentials.');
  }
  async function request(path: string, signal?: AbortSignal): Promise<unknown | null> {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort = () => {};
    const cancelled = new Promise<never>((_, reject) => {
      onAbort = () => { controller.abort(); reject(new FoodProviderError('cancelled', 'Search cancelled.')); };
      if (signal?.aborted) onAbort(); else signal?.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => { controller.abort(); reject(new FoodProviderError('timeout', 'USDA search timed out. Please try again.')); }, timeoutMs);
    });
    try {
      return await Promise.race([cancelled, (async () => {
        if (signal?.aborted) throw new FoodProviderError('cancelled', 'Search cancelled.');
        const response = await fetcher(`${base.toString().replace(/\/$/, '')}${path}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
        if (response.status === 404) return null;
        if (response.status === 408 || response.status === 504) throw new FoodProviderError('timeout', 'USDA search timed out. Please try again.');
        if (response.status === 429) {
          const seconds = Number(response.headers.get('Retry-After'));
          const retry = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 3600;
          throw new FoodProviderError('rate-limit', `USDA request limit reached. Retry in ${retry} seconds.`, retry);
        }
        if (response.status === 401 || response.status === 403 || response.status === 503) throw new FoodProviderError('authorization', 'USDA access is unavailable. Check the server API-key configuration.');
        if (!response.ok) throw new FoodProviderError('network', 'USDA search is unavailable. Please try again later.');
        try { return await response.json(); } catch { throw new FoodProviderError('response', 'USDA returned an unreadable response.'); }
      })()]);
    } catch (failure) {
      if (failure instanceof FoodProviderError) throw failure;
      throw new FoodProviderError('network', 'Could not connect to USDA. Saved and custom foods are still available offline.');
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
  }
  return {
    id: 'usda-fdc',
    async search(query, options) {
      const trimmed = query.trim();
      if (!trimmed) return [];
      if (trimmed.length > 120) throw new FoodProviderError('response', 'Keep searches within 120 characters.');
      const data = object(await request(`/foods/search?query=${encodeURIComponent(trimmed)}`, options?.signal));
      if (!Array.isArray(data.foods)) throw new FoodProviderError('response', 'USDA returned an unexpected search response.');
      return data.foods.map(mapUsdaFood).filter((food): food is ProviderFood => food !== null);
    },
    async get(id, options) {
      if (!/^[1-9]\d{0,14}$/.test(id)) throw new FoodProviderError('response', 'Invalid USDA food ID.');
      const data = await request(`/foods/${id}`, options?.signal);
      if (data === null) return null;
      const food = mapUsdaFood(data);
      if (!food || food.externalId !== id) throw new FoodProviderError('response', 'This USDA food has no supported calorie data.');
      return food;
    },
  };
}
