export const CC_MAX = 20;
export const EFM_MAX = 40;
export const FINAL_MAX = 20;

export function computeFinalGrade(cc: number | null, efm: number | null): number | null {
  if (cc === null && efm === null) return null;
  const ccVal = cc ?? 0;
  const efmVal = efm ?? 0;
  const efmOn20 = efmVal / 2;
  return Math.round((ccVal * 0.25 + efmOn20 * 0.75) * 100) / 100;
}

export function finalGradePercent(cc: number | null, efm: number | null): number {
  const final = computeFinalGrade(cc, efm);
  if (final === null) return 0;
  return Math.min(100, Math.round((final / FINAL_MAX) * 100));
}
