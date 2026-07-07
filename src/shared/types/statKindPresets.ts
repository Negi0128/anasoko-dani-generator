/**
 * theme_Genre is a fixed enum recognized by the Anasoko simulator itself
 * (confirmed against Anasoko/Scene/DanSelect/DaniData/DaniDataConfirmation.cs),
 * not free text. Each key has a canonical Japanese display label and a
 * default continuous(共通)/individual(個別) starting value used when a new
 * board is added — the user can still toggle 共通/個別 freely afterward for
 * any board. RollLess is intentionally omitted for now (not yet needed).
 */
export interface StatKindPreset {
  key: string
  label: string
  defaultContinuous: boolean
  /** Display-only comparison direction hint (未満 vs 以上); not stored in dani.json. */
  comparisonSuffix: '未満' | '以上'
}

export const STAT_KIND_PRESETS: readonly StatKindPreset[] = [
  { key: 'Great', label: '良の数', defaultContinuous: false, comparisonSuffix: '以上' },
  { key: 'Good', label: '可の数', defaultContinuous: true, comparisonSuffix: '未満' },
  { key: 'Miss', label: '不可の数', defaultContinuous: true, comparisonSuffix: '未満' },
  { key: 'Roll', label: '連打数', defaultContinuous: false, comparisonSuffix: '以上' },
  { key: 'Score', label: 'スコア', defaultContinuous: false, comparisonSuffix: '以上' },
  { key: 'HitCount', label: '叩けた数', defaultContinuous: false, comparisonSuffix: '以上' },
  { key: 'MaxCombo', label: 'コンボ数', defaultContinuous: false, comparisonSuffix: '以上' }
]

/** Multiplier applied to the red value to seed the gold value the first time
 * a board's gold condition is viewed (while it's still at its default 0). */
export const GOLD_AUTOFILL_MULTIPLIER: Record<string, number> = {
  Great: 1.1,
  Roll: 1.1,
  MaxCombo: 1.1,
  HitCount: 1.1,
  Good: 2 / 3,
  Miss: 2 / 3,
  Score: 1
}
