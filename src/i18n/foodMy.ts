import myanmarCatalog from '../data/catalog/myanmar.json' with { type: 'json' };
import { normalizeFoodName, type FoodInput, type ServingUnit } from '../domain/food.ts';
import { validateCalendarDate, type Meal } from '../domain/diary.ts';

export const foodText = {
  library: 'အစားအစာစာရင်း', name: 'အစားအစာအမည်', cuisine: 'အစားအစာအမျိုးအစား',
  calories: 'ကယ်လိုရီ (kcal)', amount: 'အစားအစာပမာဏ', unit: 'ယူနစ်',
  all: 'အားလုံး', uncategorized: 'အမျိုးအစားမသတ်မှတ်ထား',
  save: 'သိမ်းဆည်းရန်', cancel: 'ပယ်ဖျက်ရန်', remove: 'ဖျက်ရန်', retry: 'ပြန်လည်ကြိုးစားရန်',
  saving: 'သိမ်းဆည်းနေသည်…', loading: 'ဖတ်ယူနေသည်…',
  add: 'အစားအစာထည့်ရန်', edit: 'အစားအစာပြင်ရန်', details: 'အစားအစာအချက်အလက်',
  search: 'အစားအစာရှာရန်', empty: 'အစားအစာမတွေ့ပါ။', clearFilter: 'အမျိုးအစားစစ်ထုတ်မှု ဖယ်ရန်',
  unavailable: 'ကယ်လိုရီ မသိရှိသေးပါ', noValue: 'မသိရှိသေးပါ',
  unknownWarning: 'ကယ်လိုရီ မသိရှိသေးသော အစားအစာကို စားသုံးမှုနှင့် အစီအစဉ်တွင် ထည့်၍မရသေးပါ။',
  demoWarning: 'စမ်းသပ်နမူနာ၏ အာဟာရတန်ဖိုးများသည် အတည်ပြုထားခြင်းမရှိပါ။',
  invalidDate: 'ရက်စွဲ မမှန်ပါ။', loadError: 'အစားအစာအချက်အလက်ကို ဖတ်ယူ၍မရပါ။ ပြန်လည်ကြိုးစားပါ။',
  saveError: 'အစားအစာကို သိမ်းဆည်း၍မရပါ။ ပြင်ဆင်ထားသည့်အချက်များ မပျောက်ပါ။ ပြန်လည်ကြိုးစားပါ။',
  deleteError: 'အစားအစာကို ဖျက်၍မရပါ။ ပြန်လည်ကြိုးစားပါ။',
  checkFields: 'ဖြည့်ထားသော အချက်အလက်များကို ပြန်စစ်ပါ။',
  deleteTitle: 'အစားအစာကို ဖျက်မလား။', deleteHint: 'ယခင်စားသုံးမှုမှတ်တမ်းရှိ အာဟာရအချက်အလက်များကို ဆက်လက်သိမ်းထားပါမည်။',
  createVersion: 'ကိုယ်ပိုင်အစားအစာအဖြစ် ထည့်ရန်',
} as const;

export const isMyanmar = (value: string) => /[\u1000-\u109F\uAA60-\uAA7F\uA9E0-\uA9FF]/u.test(value);
const names = new Map(myanmarCatalog.foods.filter((food) => food.native_name).map((food) => [normalizeFoodName(food.name), food.native_name]));

export function displayFoodName(food: Pick<FoodInput, 'name' | 'native_name'>) {
  if (food.native_name && isMyanmar(food.native_name)) return food.native_name;
  // Old diary snapshots have no native-name field; translate only known catalog names.
  return 'native_name' in food ? food.name : names.get(normalizeFoodName(food.name)) || food.name;
}

export const unitLabels: Record<ServingUnit, string> = {
  g: 'ဂရမ် (g)', ml: 'မီလီလီတာ (ml)', serving: 'တစ်ပွဲ', piece: 'တစ်ခု',
  kg: 'ကီလိုဂရမ် (kg)', oz: 'အောင်စ (oz)', cup: 'ခွက်',
};
export const foodFormUnits = ['g', 'ml', 'serving', 'piece'] as const;
export function foodAmount(value: number, unit: ServingUnit) {
  const labels: Record<ServingUnit, string> = { g: 'ဂရမ်', ml: 'မီလီလီတာ', serving: 'ပွဲ', piece: 'ခု', kg: 'ကီလိုဂရမ်', oz: 'အောင်စ', cup: 'ခွက်' };
  return `${Number(value.toFixed(3))} ${labels[unit]}`;
}
export const mealLabels: Record<Meal, string> = { breakfast: 'နံနက်စာ', lunch: 'နေ့လယ်စာ', dinner: 'ညစာ', snacks: 'အဆာပြေ' };
export function foodDateLabel(value: string) {
  const date = validateCalendarDate(value);
  const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

const validation: Partial<Record<keyof FoodInput, string>> = {
  name: 'အမည်ကို စာလုံး ၁ မှ ၁၂၀ အတွင်း ဖြည့်ပါ။',
  calories: 'ကယ်လိုရီကို ၀ မှ ၁၀၀၀၀၀ အတွင်း ဖြည့်ပါ။ မသိပါက မဖြည့်ဘဲ ထားနိုင်ပါသည်။',
  serving_amount: 'ပမာဏကို ၀.၀၀၁ မှ ၁၀၀၀၀၀ အတွင်း ဖြည့်ပါ။', serving_unit: 'ယူနစ်ရွေးပါ။', cuisine: 'အစားအစာအမျိုးအစား ရွေးပါ။',
};
export function foodValidationErrors(errors: Partial<Record<keyof FoodInput, string>>) {
  return Object.fromEntries(Object.keys(errors).map((key) => [key, validation[key as keyof FoodInput] ?? foodText.checkFields])) as Partial<Record<keyof FoodInput, string>>;
}

export function foodErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  if (error instanceof Error && error.name === 'DuplicateFoodError') return 'ဤအမည်၊ ပမာဏနှင့် ယူနစ်တူသော အစားအစာ ရှိပြီးဖြစ်သည်။';
  if (message.includes('Calories are unavailable')) return foodText.unknownWarning;
  if (message.includes('conversion')) return 'ဤယူနစ်များကို တိုက်ရိုက်ပြောင်းလဲ၍မရပါ။';
  if (message.includes('finite quantity') || message.includes('finite serving')) return 'ပမာဏကို ၀ ထက်ကြီးပြီး ၁၀၀၀၀၀ ထက်မပိုသော ကိန်းဂဏန်းဖြင့် ဖြည့်ပါ။';
  if (message.includes('calendar date') || message.includes('valid calendar')) return foodText.invalidDate;
  if (message.includes('future date')) return 'မရောက်သေးသောနေ့အတွက် စားပြီးအဖြစ် မှတ်တမ်းတင်၍မရပါ။';
  if (message.includes('empty destination')) return 'ကူးယူမည့်နေ့တွင် အစီအစဉ်ရှိပြီးဖြစ်သည်။ အစီအစဉ်မရှိသောနေ့ကို ရွေးပါ။';
  if (message.includes('no plan to copy')) return 'ဤနေ့တွင် ကူးယူရန် အစီအစဉ်မရှိပါ။';
  if (message.includes('different destination')) return 'ကူးယူမည့်ရက်ကို အခြားရက်တစ်ရက် ရွေးပါ။';
  if (message.includes('read-only') || message.includes('already eaten')) return 'စားပြီးသော အစီအစဉ်ကို ပြင်ဆင်၍မရပါ။ စားသုံးမှုမှတ်တမ်းတွင် ပြင်ပါ။';
  return fallback;
}
