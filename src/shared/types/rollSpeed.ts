export type ShortRollComp = 'staged60fps' | 'stagedMinus1' | 'normal'

export const DEFAULT_ROLL_SPEED = 45
export const DEFAULT_SHORT_ROLL_COMP: ShortRollComp = 'staged60fps'

export const SHORT_ROLL_COMP_LABELS: Record<ShortRollComp, string> = {
  staged60fps: '段階的補正 (60fps理論値)',
  stagedMinus1: '段階的補正 (理論値-1)',
  normal: '通常計算'
}

/**
 * Converts a roll segment's duration into an expected hit count, ported
 * from NeoTJAEditor's tja_analyzer.py so numbers match what the user
 * already knows from that tool. Short rolls get a compensation bump since
 * a literal duration*rate undercounts what's actually achievable at very
 * low durations (the same rationale as the original tool).
 */
export function computeRollHits(durationSeconds: number, rollSpeed: number, comp: ShortRollComp): number {
  if (comp === 'staged60fps') {
    if (durationSeconds <= 0.1) return Math.trunc(durationSeconds * Math.max(60, rollSpeed))
    if (durationSeconds <= 0.15) return Math.trunc(durationSeconds * Math.max(55, rollSpeed))
    return Math.trunc(durationSeconds * rollSpeed)
  }
  if (comp === 'stagedMinus1') {
    if (durationSeconds <= 0.1) return Math.trunc(durationSeconds * Math.max(55, rollSpeed))
    if (durationSeconds <= 0.15) return Math.trunc(durationSeconds * Math.max(50, rollSpeed))
    return Math.trunc(durationSeconds * rollSpeed)
  }
  return Math.trunc(durationSeconds * rollSpeed)
}
