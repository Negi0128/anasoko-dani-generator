import { useEffect, useState } from 'react'
import type { DaniSetSummary, Rank } from '../../../shared/types/daniSet'
import type {
  CreatePackRuleInput,
  PackCondition,
  PackSelfTestResult
} from '../../../shared/types/pack'

interface PackMakerModalProps {
  onClose: () => void
}

interface RuleDraft {
  key: string
  targetRankFolder: string
  condition: PackCondition
  message: string
  rewardSourceFolders: string[]
}

const CONDITION_LABELS: Record<PackCondition, string> = {
  pass: '合格',
  gold: '金合格',
  fullcombo: 'フルコンボ',
  allperfect: '全良'
}

function folderNameForRank(rank: Pick<Rank, 'rankIndex' | 'rankName'>): string {
  return `${rank.rankIndex},${rank.rankName}`
}

function rankDisplayName(rank: Rank): string {
  return rank.title || rank.rankName
}

function makeEmptyRule(): RuleDraft {
  return {
    key: `${Date.now()}-${Math.random()}`,
    targetRankFolder: '',
    condition: 'pass',
    message: '',
    rewardSourceFolders: []
  }
}

function PackMakerModal({ onClose }: PackMakerModalProps): JSX.Element {
  const [sets, setSets] = useState<DaniSetSummary[]>([])
  const [setId, setSetId] = useState('')
  const [ranks, setRanks] = useState<Rank[]>([])
  const [packName, setPackName] = useState('')
  const [author, setAuthor] = useState('')
  const [rules, setRules] = useState<RuleDraft[]>([makeEmptyRule()])
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [selfTest, setSelfTest] = useState<PackSelfTestResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    window.api.sets.list().then(setSets)
  }, [])

  useEffect(() => {
    if (!setId) {
      setRanks([])
      return
    }
    window.api.sets.load(setId).then((set) => {
      setRanks(set?.ranks ?? [])
    })
  }, [setId])

  const updateRule = (key: string, patch: Partial<RuleDraft>): void => {
    setRules((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const addRule = (): void => {
    setRules((prev) => [...prev, makeEmptyRule()])
  }

  const removeRule = (key: string): void => {
    setRules((prev) => prev.filter((r) => r.key !== key))
  }

  const addRewardFolders = async (key: string): Promise<void> => {
    const picked = await window.api.dialogs.pickFolders('ごほうび曲フォルダを選択')
    if (!picked || picked.length === 0) return
    setRules((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r
        const merged = [...r.rewardSourceFolders]
        for (const p of picked) {
          if (!merged.includes(p)) merged.push(p)
        }
        return { ...r, rewardSourceFolders: merged }
      })
    )
  }

  const removeRewardFolder = (key: string, folder: string): void => {
    setRules((prev) =>
      prev.map((r) =>
        r.key === key
          ? { ...r, rewardSourceFolders: r.rewardSourceFolders.filter((f) => f !== folder) }
          : r
      )
    )
  }

  const validate = (): string[] => {
    const errors: string[] = []
    if (!setId) errors.push('対象セットを選択してください')
    if (!packName.trim()) errors.push('パック名を入力してください')
    if (rules.length === 0) errors.push('ルールを1つ以上追加してください')
    rules.forEach((r, i) => {
      if (!r.targetRankFolder) errors.push(`ルール${i + 1}: 対象段位を選択してください`)
      if (r.rewardSourceFolders.length === 0) errors.push(`ルール${i + 1}: ごほうび曲フォルダを1つ以上追加してください`)
      // 異なる親ディレクトリでもフォルダ名(basename)が同じだとzip内で衝突するため、
      // 同一ルール内での重複を検出する（path モジュールが renderer で使えないため split で代用）。
      const basenames = r.rewardSourceFolders.map((p) => p.split(/[\\/]/).pop() ?? p)
      const hasDuplicateBasename = new Set(basenames).size !== basenames.length
      if (hasDuplicateBasename) {
        errors.push(`ルール${i + 1}: 同名のごほうび曲フォルダが重複しています（フォルダ名）`)
      }
    })
    return errors
  }

  const handleSubmit = async (): Promise<void> => {
    setSubmitError(null)
    setSelfTest(null)
    const errors = validate()
    setValidationErrors(errors)
    if (errors.length > 0) return

    const destPath = await window.api.dialogs.pickSaveAnskpack(packName.trim())
    if (!destPath) return

    const rulesInput: CreatePackRuleInput[] = rules.map((r) => ({
      targetRankFolder: r.targetRankFolder,
      condition: r.condition,
      message: r.message,
      rewardSourceFolders: r.rewardSourceFolders
    }))

    setIsSubmitting(true)
    try {
      const result = await window.api.pack.create({
        setId,
        name: packName.trim(),
        author: author.trim(),
        destPath,
        rules: rulesInput
      })
      setSelfTest(result.selfTest)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal pack-maker-modal">
        <h3>楽曲解禁パックを作成</h3>

        <div className="pack-maker-basic-fields">
          <label className="pack-maker-field">
            <span>パック名</span>
            <input type="text" value={packName} onChange={(e) => setPackName(e.target.value)} />
          </label>
          <label className="pack-maker-field">
            <span>作者</span>
            <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </label>
          <label className="pack-maker-field">
            <span>対象セット</span>
            <select value={setId} onChange={(e) => setSetId(e.target.value)}>
              <option value="">選択してください</option>
              {sets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="pack-maker-rules">
          <h4>ルール</h4>
          {rules.map((rule, i) => (
            <div className="pack-maker-rule-row" key={rule.key}>
              <div className="pack-maker-rule-header">
                <span className="pack-maker-rule-index">ルール{i + 1}</span>
                {rules.length > 1 && (
                  <button className="danger-button" onClick={() => removeRule(rule.key)}>
                    削除
                  </button>
                )}
              </div>

              <div className="pack-maker-rule-fields">
                <label className="pack-maker-field">
                  <span>対象段位</span>
                  <select
                    value={rule.targetRankFolder}
                    onChange={(e) => updateRule(rule.key, { targetRankFolder: e.target.value })}
                    disabled={ranks.length === 0}
                  >
                    <option value="">選択してください</option>
                    {ranks.map((r) => (
                      <option key={r.id} value={folderNameForRank(r)}>
                        {rankDisplayName(r)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="pack-maker-field">
                  <span>解禁条件</span>
                  <select
                    value={rule.condition}
                    onChange={(e) =>
                      updateRule(rule.key, { condition: e.target.value as PackCondition })
                    }
                  >
                    {(Object.keys(CONDITION_LABELS) as PackCondition[]).map((c) => (
                      <option key={c} value={c}>
                        {CONDITION_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="pack-maker-field pack-maker-field-wide">
                  <span>解禁メッセージ</span>
                  <input
                    type="text"
                    value={rule.message}
                    onChange={(e) => updateRule(rule.key, { message: e.target.value })}
                  />
                </label>
              </div>

              <div className="pack-maker-reward-folders">
                <div className="pack-maker-reward-folders-header">
                  <span>ごほうび曲フォルダ</span>
                  <button onClick={() => addRewardFolders(rule.key)}>+ フォルダを追加</button>
                </div>
                {rule.rewardSourceFolders.length === 0 ? (
                  <p className="pack-maker-empty-hint">未選択</p>
                ) : (
                  <ul className="song-picker-list pack-maker-reward-list">
                    {rule.rewardSourceFolders.map((folder) => (
                      <li key={folder} className="pack-maker-reward-item">
                        <span className="pack-maker-reward-path">{folder}</span>
                        <button onClick={() => removeRewardFolder(rule.key, folder)}>削除</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}

          <button onClick={addRule}>+ ルールを追加</button>
        </div>

        {validationErrors.length > 0 && (
          <ul className="song-picker-list error">
            {validationErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}

        {submitError && <p className="error">{submitError}</p>}

        {selfTest && (
          <div className="pack-maker-result">
            {selfTest.ok ? (
              <p className="pack-maker-result-ok">パックを出力しました（セルフテストOK）</p>
            ) : (
              <p className="error">パックの出力に問題がありました（セルフテストNG）</p>
            )}
            <ul className="song-picker-list">
              {selfTest.rules.map((r) => (
                <li key={r.ruleId}>
                  ルール({r.ruleId.slice(0, 8)}...): ごほうび曲 {r.actualFileCount}/
                  {r.expectedFileCount} {r.ok ? 'OK' : 'NG'}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="confirm-dialog-actions">
          <button onClick={onClose}>閉じる</button>
          <button className="primary-button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? '出力中…' : 'パック出力'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PackMakerModal
