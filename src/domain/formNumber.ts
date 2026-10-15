export function parseFormNumber(input: string) {
  const value = input.normalize('NFKC').trim();
  // Treat one comma or dot as decimal; never infer thousands grouping.
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value)) return NaN;
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) ? number : NaN;
}
