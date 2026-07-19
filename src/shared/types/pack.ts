export type PackCondition = 'pass' | 'gold' | 'fullcombo' | 'allperfect'

export interface PackManifestRuleV3 {
  rule_id: string
  target_rank_folder: string
  target_dan_display: string
  condition: PackCondition
  message: string
  /** Display-only song folder names; actual placement folder is chosen by the player on import. */
  reward_songs: string[]
}

export interface PackManifestV3 {
  format_version: 3
  name: string
  author: string
  pack_id: string
  /** Dani install folder name basis, derived from the set title (Monitor renumbers on collision). */
  set_folder: string
  rules: PackManifestRuleV3[]
}

export interface CreatePackRuleInput {
  /** "<N>,<名前>" rank folder name within the set, identifies the trigger rank. */
  targetRankFolder: string
  condition: PackCondition
  message: string
  /** Absolute paths to song folders on disk; each becomes a top-level folder inside the reward zip. */
  rewardSourceFolders: string[]
}

export interface CreatePackParamsInput {
  setId: string
  name: string
  author: string
  destPath: string
  rules: CreatePackRuleInput[]
}

export interface PackSelfTestRuleResult {
  ruleId: string
  expectedFileCount: number
  actualFileCount: number
  ok: boolean
}

export interface PackSelfTestResult {
  manifestOk: boolean
  rules: PackSelfTestRuleResult[]
  ok: boolean
}

export interface CreatePackResult {
  selfTest: PackSelfTestResult
}
