const readableNumberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 6,
});

export function formatReadableNumber(value: number): string {
  return readableNumberFormatter.format(value);
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}
