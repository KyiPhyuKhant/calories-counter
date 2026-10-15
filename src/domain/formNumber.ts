export function parseFormNumber(input: string) {
  const value = input.normalize('NFKC').replace(/[၀-၉]/g, (digit) => String(digit.charCodeAt(0) - 0x1040)).trim();
  // Treat one comma or dot as decimal; never infer thousands grouping.
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value)) return NaN;
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) ? number : NaN;
}
