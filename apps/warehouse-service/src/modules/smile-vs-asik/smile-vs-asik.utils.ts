export function calculatePercentage(
  numerator: number,
  denominator: number,
  usePercent = true
): string {
  if (denominator === 0) return "-"
  const value = (numerator / denominator) * 100
  const rounded = Math.round(value * 100) / 100
  return usePercent ? `${rounded}%` : rounded.toString()
}
