import { GOLD_AUTOFILL_MULTIPLIER } from './statKindPresets'

export interface AnalysisBorder {
  red: number
  gold: number
}

/** 1曲分の譜面解析の内訳。 */
export interface RollBreakdown {
  /** 音符(ドン/カツ)の打数。 */
  donKatsu: number
  /** 通常連打(風船以外)で打てる回数の目安。 */
  normalRoll: number
  /** 風船の打数(BALLOON*ヘッダーの合計)。 */
  balloon: number
}

/** 連打数の条件値。金合格は解析値そのもの(通常連打+風船の満数)を要求し、
 * 赤合格はそこから逆算する: 通常連打は倍率で割り、風船は取りこぼし1個分を引く。
 * 例) 100(うち風船50)なら 金=100、赤=round(50/1.1)+(50-1)=94。
 * 連打数は理論上の頭打ちがある指標ではないため、クランプはしない。 */
export function analysisRollBorder(b: RollBreakdown, divisor: number): AnalysisBorder {
  return {
    gold: b.normalRoll + b.balloon,
    red: Math.round(b.normalRoll / divisor) + Math.max(b.balloon - 1, 0)
  }
}

/** たたけた数の条件値。金合格は理論値(音符数+連打の満数)、赤合格は連打と同じ考え方で
 * 音符数・通常連打を倍率で割り、風船は取りこぼし1個分を引く。 */
export function analysisHitCountBorder(b: RollBreakdown, divisor: number): AnalysisBorder {
  return {
    gold: b.donKatsu + b.normalRoll + b.balloon,
    red:
      Math.round(b.donKatsu / divisor) +
      Math.round(b.normalRoll / divisor) +
      Math.max(b.balloon - 1, 0)
  }
}

/** コンボ数の条件値。コンボは連打(風船含む)を叩いてもリセットされないだけで、
 * 連打自体はコンボ数にカウントされないため、音符打数のみを対象にする。
 * 金合格はフルコンボ(音符数)、赤合格はそこから倍率で逆算。 */
export function analysisMaxComboBorder(b: RollBreakdown, divisor: number): AnalysisBorder {
  return {
    gold: b.donKatsu,
    red: Math.round(b.donKatsu / divisor)
  }
}

/** 解析値から出せる条件種別。これ以外(可の数など)は譜面から推定できない。 */
export const ANALYZABLE_STAT_LABELS: ReadonlySet<string> = new Set(['Roll', 'MaxCombo', 'HitCount'])

export function analysisBorderFor(label: string, breakdown: RollBreakdown): AnalysisBorder {
  const divisor = GOLD_AUTOFILL_MULTIPLIER[label] ?? 1
  if (label === 'Roll') return analysisRollBorder(breakdown, divisor)
  if (label === 'MaxCombo') return analysisMaxComboBorder(breakdown, divisor)
  return analysisHitCountBorder(breakdown, divisor)
}
