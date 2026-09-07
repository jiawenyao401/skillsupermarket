/** Missing/empty samples are not a measured 0% outcome. Counts may exceed the
 * denominator for repeat-click metrics; do not silently clamp those ratios. */
export function growthPercentage(value: number | undefined, total: number | undefined): number | null {
  if (value === undefined || total === undefined
    || !Number.isSafeInteger(value) || !Number.isSafeInteger(total)
    || value < 0 || total <= 0) return null;
  return (value / total) * 100;
}
