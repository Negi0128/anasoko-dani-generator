import { useEffect, useRef, useState } from 'react'
import type { DaniSet, Rank, SongSlot, StatKind } from '../../../shared/types/daniSet'
import type { SongAssetResult, SongCourse, SongCourseBranchAnalysis, TjaBranch } from '../../../shared/types/song'
import { GAIDEN_START_INDEX, RANK_NAME_PRESETS } from '../../../shared/types/rankPresets'
import { GOLD_AUTOFILL_MULTIPLIER, STAT_KIND_PRESETS } from '../../../shared/types/statKindPresets'
import { COURSE_LABELS, courseNameToIndex } from '../../../shared/types/coursePresets'
import { CONDITION_PRESETS } from '../../../shared/types/conditionPresets'
import type { ValidationReport } from '../../../shared/types/validationReport'
import type { ExportFolderConflict } from '../../../shared/types/exportConflict'
import {
  computeRollHits,
  DEFAULT_ROLL_SPEED,
  DEFAULT_SHORT_ROLL_COMP,
  type ShortRollComp
} from '../../../shared/types/rollSpeed'
import NumberInput from '../components/NumberInput'
import ConfirmDialog from '../components/ConfirmDialog'
import PromptDialog from '../components/PromptDialog'
import ExportValidationModal from '../components/ExportValidationModal'
import ExportOverwriteModal from '../components/ExportOverwriteModal'

const BRANCH_LABELS: Record<TjaBranch, string> = { N: '普通', E: '玄人', M: '達人' }

function courseForSlot(slot: SongSlot): SongCourse | undefined {
  return (slot.courses ?? []).find((c) => courseNameToIndex(c.course) === slot.diff)
}

/** The branch (普通/玄人/達人) to reference for analysis: the slot's own
 * override if the user picked one, otherwise the course's own default
 * (達人 > 玄人 > 普通, whichever hardest branch actually has notes). */
function activeBranchFor(slot: SongSlot, course: SongCourse): TjaBranch {
  return slot.analysisBranch ?? course.defaultBranch ?? 'N'
}

/** Courses assigned before branch-aware analysis existed won't have
 * `branches`/`defaultBranch` yet (the self-heal effect fixes this shortly
 * after mount, but the very first render still needs to not crash on them). */
function branchAnalysisForSlot(slot: SongSlot): SongCourseBranchAnalysis | undefined {
  const course = courseForSlot(slot)
  if (!course || !course.branches) return undefined
  return course.branches[activeBranchFor(slot, course)]
}

function slotDonKatsuCount(slot: SongSlot): number {
  return branchAnalysisForSlot(slot)?.donKatsuCount ?? 0
}

/** 風船だけの目安打数(BALLOON*ヘッダーの合計)。 */
function slotBalloonOnlyTotal(slot: SongSlot): number {
  const analysis = branchAnalysisForSlot(slot)
  return (analysis?.balloonHits ?? []).reduce((sum, v) => sum + v, 0)
}

/** 連打数の目安値: 風船打数(BALLOON:の値)+通常連打で打てる回数の合計。
 * 曲データがこの機能の追加前に取り込まれたものだと分岐別の解析結果が無い場合が
 * あるため、その場合は0扱いにする。 */
function slotRollHitsTotal(slot: SongSlot, rollSpeed: number, comp: ShortRollComp): number {
  const analysis = branchAnalysisForSlot(slot)
  if (!analysis) return 0
  const rollHits = (analysis.rollDurations ?? []).reduce((sum, d) => sum + computeRollHits(d, rollSpeed, comp), 0)
  return rollHits + slotBalloonOnlyTotal(slot)
}

/** たたけた数/コンボ数の目安値: 音符数+連打数の目安値の合計。 */
function slotHitCountTotal(slot: SongSlot, rollSpeed: number, comp: ShortRollComp): number {
  return slotDonKatsuCount(slot) + slotRollHitsTotal(slot, rollSpeed, comp)
}

/** Stat kinds whose target counts can be estimated from a chart's own note data. */
const ANALYZABLE_STAT_LABELS = new Set(['Roll', 'MaxCombo', 'HitCount'])

interface SlotRollBreakdown {
  donKatsu: number
  /** 通常連打(風船以外)で打てる回数。 */
  normalRoll: number
  /** 風船だけの目安打数(BALLOON*ヘッダーの合計)。 */
  balloon: number
}

function slotRollBreakdown(slot: SongSlot, rollSpeed: number, comp: ShortRollComp): SlotRollBreakdown {
  const analysis = branchAnalysisForSlot(slot)
  const normalRoll = analysis
    ? (analysis.rollDurations ?? []).reduce((sum, d) => sum + computeRollHits(d, rollSpeed, comp), 0)
    : 0
  return { donKatsu: slotDonKatsuCount(slot), normalRoll, balloon: slotBalloonOnlyTotal(slot) }
}

/** 風船と通常連打を別計算にした条件値の目安。
 * 赤合格: 通常連打はそのまま、風船は取りこぼし余地を見て打数-1(0未満にはしない)。
 * 金合格: 通常連打に倍率を掛け、風船はそのまま加算(取りこぼし猶予なし)。
 * 連打数自体には理論上の上限がある指標ではない(倍率で満数を超えて要求してよい)ため、
 * ここではクランプしない。 */
function analysisRollValue(b: SlotRollBreakdown, mode: BorderMode, multiplier: number): number {
  if (mode === 'red') {
    return b.normalRoll + Math.max(b.balloon - 1, 0)
  }
  return Math.round(b.normalRoll * multiplier) + b.balloon
}

/** たたけた数の条件値の目安。連打部分は analysisRollValue と同じ考え方で、
 * 音符打数にも金合格時のみ倍率を掛ける。理論値(音符数+連打の満数)を超えないようにする。 */
function analysisHitCountValue(b: SlotRollBreakdown, mode: BorderMode, multiplier: number): number {
  const theoreticalMax = b.donKatsu + b.normalRoll + b.balloon
  if (mode === 'red') {
    const balloonPart = Math.max(b.balloon - 1, 0)
    return Math.min(b.donKatsu + b.normalRoll + balloonPart, theoreticalMax)
  }
  const gold = Math.round(b.donKatsu * multiplier) + Math.round(b.normalRoll * multiplier) + b.balloon
  return Math.min(gold, theoreticalMax)
}

/** コンボ数の条件値の目安。コンボは連打(風船含む)を叩いてもリセットされないだけで、
 * 連打自体はコンボ数にカウントされないため、音符打数のみを対象にする。
 * 理論値(音符数)を超えないようにする。 */
function analysisMaxComboValue(b: SlotRollBreakdown, mode: BorderMode, multiplier: number): number {
  if (mode === 'red') return b.donKatsu
  return Math.min(Math.round(b.donKatsu * multiplier), b.donKatsu)
}

function analysisValuesForStatKind(
  label: string,
  slots: SongSlot[],
  rollSpeed: number,
  comp: ShortRollComp,
  mode: BorderMode
): number[] {
  const multiplier = GOLD_AUTOFILL_MULTIPLIER[label] ?? 1
  return slots.map((s) => {
    const breakdown = slotRollBreakdown(s, rollSpeed, comp)
    if (label === 'Roll') return analysisRollValue(breakdown, mode, multiplier)
    if (label === 'MaxCombo') return analysisMaxComboValue(breakdown, mode, multiplier)
    return analysisHitCountValue(breakdown, mode, multiplier)
  })
}

interface SetEditorScreenProps {
  setId: string
  onBack: () => void
}

const MAX_STAT_KINDS = 3
const FIXED_SONG_COUNT = 3
const GAIDEN_OPTION_VALUE = '__gaiden__'
type BorderMode = 'red' | 'gold'

function emptyRank(rankIndex: number, rankName: string): Rank {
  return {
    id: crypto.randomUUID(),
    rankIndex,
    rankName,
    title: '',
    gauge: { red: 100, gold: 100 },
    statKinds: [],
    songSlots: Array.from({ length: FIXED_SONG_COUNT }, () => ({
      id: crypto.randomUUID(),
      tjaRelPath: null,
      oggRelPath: null,
      songTitle: null,
      courses: [],
      diff: 3,
      songGenreLabel: '',
      hidden: false,
      analysisBranch: null
    }))
  }
}

function highestAvailableCourseIndex(asset: SongAssetResult): number {
  const indexes = asset.courses
    .map((c) => courseNameToIndex(c.course))
    .filter((i): i is number => i !== null)
  return indexes.length > 0 ? Math.max(...indexes) : 3
}

/** Keeps ranks sorted by rankIndex regardless of the order they were added in,
 * so navigating "forward" always moves toward a bigger rank number. */
function insertRankSorted(ranks: Rank[], newRank: Rank): Rank[] {
  const insertAt = ranks.findIndex((r) => r.rankIndex > newRank.rankIndex)
  if (insertAt === -1) return [...ranks, newRank]
  return [...ranks.slice(0, insertAt), newRank, ...ranks.slice(insertAt)]
}

/** 五級~一級=木, 初段~五段=青, 六段~十段=赤, 玄人~超人=銀, 達人=金, 外伝(19+)=緑。 */
function rankTierClassName(rankIndex: number): string {
  if (rankIndex <= 4) return 'tier-wood'
  if (rankIndex <= 9) return 'tier-blue'
  if (rankIndex <= 14) return 'tier-red'
  if (rankIndex <= 17) return 'tier-silver'
  if (rankIndex === 18) return 'tier-gold'
  return 'tier-gaiden'
}

function SetEditorScreen({ setId, onBack }: SetEditorScreenProps): JSX.Element {
  const [set, setSet] = useState<DaniSet | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [pickingSlotId, setPickingSlotId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [borderMode, setBorderMode] = useState<BorderMode>('red')
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [screenError, setScreenError] = useState<string | null>(null)
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null)
  const [exportConflict, setExportConflict] = useState<{
    conflict: ExportFolderConflict
    destDir: string
  } | null>(null)
  const [showGaidenPrompt, setShowGaidenPrompt] = useState(false)
  const [rollSpeed, setRollSpeed] = useState(DEFAULT_ROLL_SPEED)
  const [shortRollComp, setShortRollComp] = useState<ShortRollComp>(DEFAULT_SHORT_ROLL_COMP)
  const savedSnapshotRef = useRef<string | null>(null)

  useEffect(() => {
    window.api.sets.load(setId).then((loaded) => {
      setSet(loaded)
      savedSnapshotRef.current = JSON.stringify(loaded)
    })
  }, [setId])

  useEffect(() => {
    window.api.settings.get().then((s) => {
      setRollSpeed(s.rollSpeed)
      setShortRollComp(s.shortRollComp)
    })
  }, [])

  const isDirty = savedSnapshotRef.current !== null && JSON.stringify(set) !== savedSnapshotRef.current

  useEffect(() => {
    window.api.app.setDirty(isDirty)
  }, [isDirty])

  useEffect(() => {
    return () => {
      window.api.app.setDirty(false)
    }
  }, [])

  const rank = set?.ranks[currentIndex] ?? null

  // Self-heals slots assigned before branch-aware analysis (or a parsing fix)
  // existed: re-analyzes the already-copied tja file for whichever of the
  // current rank's songs still lack that data.
  useEffect(() => {
    if (!rank) return
    const rankId = rank.id
    rank.songSlots.forEach((slot) => {
      if (!slot.tjaRelPath) return
      const needsReanalysis = slot.courses.some((c) => c.branches === undefined || c.defaultBranch === undefined)
      if (!needsReanalysis) return
      window.api.songAssets.analyze(slot.tjaRelPath).then((courses) => {
        setSet((prev) =>
          prev
            ? {
                ...prev,
                ranks: prev.ranks.map((r) =>
                  r.id === rankId
                    ? { ...r, songSlots: r.songSlots.map((s) => (s.id === slot.id ? { ...s, courses } : s)) }
                    : r
                )
              }
            : prev
        )
      })
    })
  }, [rank])

  const usedRankIndexes = new Set(set?.ranks.map((r) => r.rankIndex) ?? [])
  const availableRankPresets = RANK_NAME_PRESETS.map((name, index) => ({ name, index })).filter(
    (p) => !usedRankIndexes.has(p.index)
  )
  const gaidenCount = set?.ranks.filter((r) => r.rankIndex >= GAIDEN_START_INDEX).length ?? 0
  const availableStatKindPresets = STAT_KIND_PRESETS.filter(
    (p) => !rank?.statKinds.some((s) => s.label === p.key)
  )

  const updateRank = (updater: (r: Rank) => Rank): void => {
    setSet((prev) =>
      prev
        ? { ...prev, ranks: prev.ranks.map((r, i) => (i === currentIndex ? updater(r) : r)) }
        : prev
    )
  }

  const handleAddRank = (index: number, name: string): void => {
    if (!set) return
    const newRank = emptyRank(index, name)
    const ranks = insertRankSorted(set.ranks, newRank)
    setSet({ ...set, ranks })
    setCurrentIndex(ranks.findIndex((r) => r.id === newRank.id))
  }

  const handleAddGaidenRank = (name: string): void => {
    if (!set) return
    const nextIndex = Math.max(GAIDEN_START_INDEX - 1, ...set.ranks.map((r) => r.rankIndex)) + 1
    handleAddRank(nextIndex, name)
  }

  const handleAddRankSelect = (value: string): void => {
    if (value === GAIDEN_OPTION_VALUE) {
      setShowGaidenPrompt(true)
      return
    }
    const preset = availableRankPresets.find((p) => p.name === value)
    if (preset) handleAddRank(preset.index, preset.name)
  }

  const handleRemoveRank = (): void => {
    if (!set || !rank) return
    if (!window.confirm(`「${rank.rankIndex},${rank.rankName}」を削除しますか?`)) return
    const ranks = set.ranks.filter((_, i) => i !== currentIndex)
    setSet({ ...set, ranks })
    setCurrentIndex((i) => Math.max(0, Math.min(i, ranks.length - 1)))
  }

  const handleAddStatKind = (key: string): void => {
    if (!rank || rank.statKinds.length >= MAX_STAT_KINDS) return
    // Defaults to 共通(continuous) per the user's preference for this tool, regardless
    // of the real simulator's per-type default (see project_stat_kind_enum memory).
    updateRank((r) => ({
      ...r,
      statKinds: [...r.statKinds, { label: key, continuous: true, cumulativeBorder: { red: 0, gold: 0 } }]
    }))
  }

  const handleApplyConditionPreset = (presetName: string): void => {
    const preset = CONDITION_PRESETS.find((p) => p.name === presetName)
    if (!preset) return
    updateRank((r) => ({
      ...r,
      gauge: { ...preset.gauge },
      statKinds: preset.statKinds.map((stat) =>
        stat.continuous
          ? { ...stat, cumulativeBorder: { ...(stat.cumulativeBorder ?? { red: 0, gold: 0 }) } }
          : {
              ...stat,
              perSongBorders: r.songSlots.map((_, i) => ({ ...(stat.perSongBorders?.[i] ?? { red: 0, gold: 0 }) }))
            }
      )
    }))
  }

  const handleClearConditions = (): void => {
    if (!window.confirm('この段位の条件をすべて削除しますか?')) return
    updateRank((r) => ({ ...r, statKinds: [] }))
  }

  const handleRemoveStatKind = (index: number): void => {
    updateRank((r) => ({ ...r, statKinds: r.statKinds.filter((_, i) => i !== index) }))
  }

  const handleToggleContinuous = (index: number): void => {
    updateRank((r) => ({
      ...r,
      statKinds: r.statKinds.map((stat, i) => {
        if (i !== index) return stat
        return stat.continuous
          ? ({
              label: stat.label,
              continuous: false,
              perSongBorders: stat.perSongBorders ?? r.songSlots.map(() => ({ red: 0, gold: 0 }))
            } satisfies StatKind)
          : ({
              label: stat.label,
              continuous: true,
              cumulativeBorder: stat.cumulativeBorder ?? { red: 0, gold: 0 }
            } satisfies StatKind)
      })
    }))
  }

  const updateCumulativeBorderValue = (index: number, mode: BorderMode, value: number): void => {
    updateRank((r) => ({
      ...r,
      statKinds: r.statKinds.map((s, i) =>
        i === index
          ? { ...s, cumulativeBorder: { ...(s.cumulativeBorder ?? { red: 0, gold: 0 }), [mode]: value } }
          : s
      )
    }))
  }

  const updatePerSongBorderValue = (
    index: number,
    songIndex: number,
    mode: BorderMode,
    value: number
  ): void => {
    updateRank((r) => ({
      ...r,
      statKinds: r.statKinds.map((s, i) => {
        if (i !== index) return s
        const values = [...(s.perSongBorders ?? r.songSlots.map(() => ({ red: 0, gold: 0 })))]
        values[songIndex] = { ...values[songIndex], [mode]: value }
        return { ...s, perSongBorders: values }
      })
    }))
  }

  const handleApplyAnalysisValue = (index: number, mode: BorderMode): void => {
    if (!rank) return
    const stat = rank.statKinds[index]
    if (!stat) return
    const values = analysisValuesForStatKind(stat.label, rank.songSlots, rollSpeed, shortRollComp, mode)
    if (stat.continuous) {
      updateCumulativeBorderValue(index, mode, Math.round(values.reduce((sum, v) => sum + v, 0)))
    } else {
      values.forEach((v, songIndex) => updatePerSongBorderValue(index, songIndex, mode, Math.round(v)))
    }
  }

  const updateGaugeValue = (mode: BorderMode, value: number): void => {
    updateRank((r) => ({ ...r, gauge: { ...r.gauge, [mode]: value } }))
  }

  /** The first time a board's gold condition is viewed (while still at its
   * default 0), seed it from the red value using the per-stat-kind multiplier. */
  const autofillGoldFromRed = (): void => {
    updateRank((r) => ({
      ...r,
      statKinds: r.statKinds.map((stat) => {
        const multiplier = GOLD_AUTOFILL_MULTIPLIER[stat.label] ?? 1
        if (stat.continuous) {
          const border = stat.cumulativeBorder ?? { red: 0, gold: 0 }
          if (border.gold !== 0) return stat
          return { ...stat, cumulativeBorder: { red: border.red, gold: Math.round(border.red * multiplier) } }
        }
        const borders = stat.perSongBorders ?? r.songSlots.map(() => ({ red: 0, gold: 0 }))
        return {
          ...stat,
          perSongBorders: borders.map((b) =>
            b.gold !== 0 ? b : { red: b.red, gold: Math.round(b.red * multiplier) }
          )
        }
      })
    }))
  }

  const handleToggleBorderMode = (): void => {
    if (borderMode === 'red') autofillGoldFromRed()
    setBorderMode((m) => (m === 'red' ? 'gold' : 'red'))
  }

  const updateSongSlot = (slotId: string, patch: Partial<SongSlot>): void => {
    updateRank((r) => ({
      ...r,
      songSlots: r.songSlots.map((slot) => (slot.id === slotId ? { ...slot, ...patch } : slot))
    }))
  }

  const handlePickSongForSlot = async (slotId: string): Promise<void> => {
    setScreenError(null)
    setPickingSlotId(slotId)
    try {
      const tjaPath = await window.api.dialogs.pickTjaFile()
      if (!tjaPath) return
      const asset = await window.api.songAssets.assign(tjaPath)
      updateSongSlot(slotId, {
        tjaRelPath: asset.tjaRelPath,
        oggRelPath: asset.oggRelPath,
        songTitle: asset.songTitle,
        courses: asset.courses,
        diff: highestAvailableCourseIndex(asset)
      })
    } catch (e) {
      setScreenError(e instanceof Error ? e.message : String(e))
    } finally {
      setPickingSlotId(null)
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!set) return
    setSaving(true)
    try {
      const saved = await window.api.sets.save(set)
      if (saved) {
        setSet(saved)
        savedSnapshotRef.current = JSON.stringify(saved)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleBack = (): void => {
    if (isDirty) {
      setShowLeaveConfirm(true)
      return
    }
    onBack()
  }

  const handleExportFolder = async (): Promise<void> => {
    if (!set) return
    setScreenError(null)
    try {
      if (isDirty) await handleSave()
      const report = await window.api.sets.validate(set.id)
      if (!report.isValid) {
        setValidationReport(report)
        return
      }
      const settings = await window.api.settings.get()
      const destDir = settings.defaultDaniFolder ?? (await window.api.dialogs.pickSaveFolder())
      if (!destDir) return
      const conflict = await window.api.sets.checkExportFolderConflict(set.id, destDir)
      if (conflict) {
        setExportConflict({ conflict, destDir })
        return
      }
      const exportReport = await window.api.sets.exportToFolder(set.id, destDir)
      window.alert(`エクスポート完了: ${exportReport.ranksExported}段位を書き出しました`)
    } catch (e) {
      setScreenError(e instanceof Error ? e.message : String(e))
    }
  }

  const resolveExportConflict = async (mode: 'overwrite' | 'new'): Promise<void> => {
    if (!exportConflict || !set) return
    const { conflict, destDir } = exportConflict
    setExportConflict(null)
    try {
      const exportReport = await window.api.sets.exportToFolder(
        set.id,
        destDir,
        mode === 'overwrite' ? conflict.folderName : undefined
      )
      window.alert(`エクスポート完了: ${exportReport.ranksExported}段位を書き出しました`)
    } catch (e) {
      setScreenError(e instanceof Error ? e.message : String(e))
    }
  }

  if (!set) return <p>読み込み中...</p>

  return (
    <div className={`rank-editor-fullscreen border-mode-${borderMode}`}>
      <div className="rank-editor-topbar">
        <button onClick={handleBack}>← 段位道場一覧</button>
        <button onClick={handleSave} disabled={saving}>
          保存
        </button>
        <button onClick={handleExportFolder}>フォルダ出力</button>
      </div>

      {screenError && <p className="error">{screenError}</p>}

      {showLeaveConfirm && (
        <ConfirmDialog
          title="保存されていない変更があります"
          message="変更を破棄して一覧に戻りますか?"
          confirmLabel="破棄して戻る"
          onConfirm={() => {
            setShowLeaveConfirm(false)
            onBack()
          }}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      )}

      {validationReport && (
        <ExportValidationModal report={validationReport} onClose={() => setValidationReport(null)} />
      )}

      {exportConflict && (
        <ExportOverwriteModal
          conflict={exportConflict.conflict}
          onOverwrite={() => resolveExportConflict('overwrite')}
          onExportAsNew={() => resolveExportConflict('new')}
          onCancel={() => setExportConflict(null)}
        />
      )}

      {showGaidenPrompt && (
        <PromptDialog
          title="外伝の名前を入力"
          defaultValue={`外伝${gaidenCount + 1}`}
          onConfirm={(name) => {
            setShowGaidenPrompt(false)
            handleAddGaidenRank(name)
          }}
          onCancel={() => setShowGaidenPrompt(false)}
        />
      )}

      {!rank ? (
        <div className="add-first-rank">
          <p>まだ段位がありません。最初の段位を追加してください。</p>
          <AddRankSelect
            availableRankPresets={availableRankPresets}
            onSelect={handleAddRankSelect}
          />
        </div>
      ) : (
        <>
          <input
            className="rank-title-pill"
            type="text"
            placeholder="この段位のタイトル"
            value={rank.title}
            onChange={(e) => updateRank((r) => ({ ...r, title: e.target.value }))}
          />

          <div className="rank-editor-main">
            <div className="song-list-panel">
              {rank.songSlots.map((slot, i) => {
                const isAssigned = slot.tjaRelPath !== null
                const availableCourseIndexes = isAssigned
                  ? slot.courses
                      .map((c) => courseNameToIndex(c.course))
                      .filter((idx): idx is number => idx !== null)
                  : []

                return (
                  <div key={slot.id} className="song-row">
                    <span className={`order-badge order-${i}`}>{['1st', '2nd', '3rd'][i]}</span>
                    <button
                      className="song-title-btn"
                      onClick={() => handlePickSongForSlot(slot.id)}
                      disabled={pickingSlotId === slot.id}
                    >
                      {pickingSlotId === slot.id
                        ? '読み込み中...'
                        : isAssigned
                          ? slot.hidden
                            ? '???'
                            : slot.songTitle
                          : 'クリックして曲を選択'}
                    </button>
                    <select
                      className="course-select"
                      value={slot.diff}
                      disabled={!isAssigned}
                      onChange={(e) => updateSongSlot(slot.id, { diff: Number(e.target.value) })}
                    >
                      {COURSE_LABELS.map((label, idx) => (
                        <option
                          key={idx}
                          value={idx}
                          disabled={isAssigned ? !availableCourseIndexes.includes(idx) : false}
                        >
                          {label}
                        </option>
                      ))}
                    </select>
                    <label className="hidden-toggle">
                      <input
                        type="checkbox"
                        checked={slot.hidden}
                        onChange={(e) => updateSongSlot(slot.id, { hidden: e.target.checked })}
                      />
                      隠し
                    </label>
                  </div>
                )
              })}
            </div>

            <div className="rank-badge-panel">
              <div className="rank-nav-horizontal">
                <button
                  className="rank-nav-arrow"
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  disabled={currentIndex === 0}
                >
                  ◀
                </button>
                <div className={`rank-badge ${rankTierClassName(rank.rankIndex)}`}>
                  <div className="rank-badge-name">{rank.rankName}</div>
                  <div className="rank-badge-index">#{rank.rankIndex}</div>
                </div>
                <button
                  className="rank-nav-arrow"
                  onClick={() => setCurrentIndex((i) => Math.min(set.ranks.length - 1, i + 1))}
                  disabled={currentIndex === set.ranks.length - 1}
                >
                  ▶
                </button>
              </div>

              <div className="rank-manage-buttons">
                <AddRankSelect
                  availableRankPresets={availableRankPresets}
                  onSelect={handleAddRankSelect}
                  label="+ 段位追加"
                />
                <button onClick={handleRemoveRank}>この段位を削除</button>
              </div>
            </div>
          </div>

          <div className="analysis-section">
            <h3 className="analysis-section-title">譜面解析</h3>
            <div className="analysis-section-body">
              <table className="analysis-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>曲</th>
                    <th>分岐</th>
                    <th>Lv</th>
                    <th>ノーツ数</th>
                    <th className="formula-connector formula-plus">+</th>
                    <th>連打数(風船)</th>
                    <th className="formula-connector formula-eq">=</th>
                    <th>たたけた数</th>
                  </tr>
                </thead>
                <tbody>
                  {rank.songSlots.map((slot, i) => {
                    const isAssigned = slot.tjaRelPath !== null
                    const course = isAssigned ? courseForSlot(slot) : undefined
                    return (
                      <tr key={slot.id}>
                        <td>
                          <span className={`order-badge order-${i}`}>{['1st', '2nd', '3rd'][i]}</span>
                        </td>
                        <td className="song-name-cell">
                          <span className="song-name-text">
                            {isAssigned ? (slot.hidden ? '???' : slot.songTitle) : '未選択'}
                          </span>
                          {course?.hasBranches && (
                            <span className="branch-warning" title="この譜面には譜面分岐があります">
                              分岐あり
                            </span>
                          )}
                        </td>
                        <td>
                          {course?.hasBranches ? (
                            <select
                              className="branch-select"
                              value={slot.analysisBranch ?? course.defaultBranch}
                              onChange={(e) =>
                                updateSongSlot(slot.id, { analysisBranch: e.target.value as TjaBranch })
                              }
                            >
                              {(['N', 'E', 'M'] as const)
                                .filter((b) => course.branches[b])
                                .map((b) => (
                                  <option key={b} value={b}>
                                    {BRANCH_LABELS[b]}
                                  </option>
                                ))}
                            </select>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>{isAssigned ? (course?.level ?? '-') : '-'}</td>
                        <td>{isAssigned ? slotDonKatsuCount(slot) : '-'}</td>
                        <td className="formula-connector formula-plus">+</td>
                        <td>
                          {isAssigned
                            ? `${slotRollHitsTotal(slot, rollSpeed, shortRollComp)}(${slotBalloonOnlyTotal(slot)})`
                            : '-'}
                        </td>
                        <td className="formula-connector formula-eq">=</td>
                        <td>{isAssigned ? slotHitCountTotal(slot, rollSpeed, shortRollComp) : '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="rank-analysis-total">
                <div className="rank-analysis-total-title">3曲合計</div>
                <div className="analysis-formula-guide">
                  <span>ノーツ数</span>
                  <span className="formula-connector formula-plus">+</span>
                  <span>連打数(風船)</span>
                  <span className="formula-connector formula-eq">=</span>
                  <span>たたけた数</span>
                </div>
                <div className="analysis-formula">
                  <span>{rank.songSlots.reduce((sum, s) => sum + slotDonKatsuCount(s), 0)}</span>
                  <span className="formula-connector formula-plus">+</span>
                  <span>
                    {rank.songSlots.reduce((sum, s) => sum + slotRollHitsTotal(s, rollSpeed, shortRollComp), 0)}(
                    {rank.songSlots.reduce((sum, s) => sum + slotBalloonOnlyTotal(s), 0)})
                  </span>
                  <span className="formula-connector formula-eq">=</span>
                  <span>{rank.songSlots.reduce((sum, s) => sum + slotHitCountTotal(s, rollSpeed, shortRollComp), 0)}</span>
                </div>
              </div>

              {rank.statKinds.some((s) => ANALYZABLE_STAT_LABELS.has(s.label)) && (
                <div className="analysis-apply-panel">
                  <div className="rank-analysis-total-title">解析値を反映</div>
                  {rank.statKinds.map((stat, i) => {
                    if (!ANALYZABLE_STAT_LABELS.has(stat.label)) return null
                    const preset = STAT_KIND_PRESETS.find((p) => p.key === stat.label)
                    return (
                      <div key={i} className="analysis-apply-row">
                        <span className="board-label-pill">{preset?.label ?? stat.label}</span>
                        <button onClick={() => handleApplyAnalysisValue(i, 'red')}>赤に反映</button>
                        <button onClick={() => handleApplyAnalysisValue(i, 'gold')}>金に反映</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="boards-section">
            <div className="boards-toolbar">
              <button
                className={`border-mode-button ${borderMode}`}
                onClick={handleToggleBorderMode}
              >
                現在: {borderMode === 'red' ? '赤条件' : '金条件'}(クリックで切替)
              </button>

              <div className="gauge-inline">
                <span>魂ゲージ</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={rank.gauge[borderMode]}
                  onChange={(e) => updateGaugeValue(borderMode, Number(e.target.value))}
                />
                <NumberInput
                  value={rank.gauge[borderMode]}
                  onChange={(v) => updateGaugeValue(borderMode, v)}
                  min={0}
                  max={100}
                />
                <span>% 以上</span>
              </div>

              {availableStatKindPresets.length > 0 && rank.statKinds.length < MAX_STAT_KINDS && (
                <select
                  className="add-board-select"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) handleAddStatKind(e.target.value)
                    e.target.value = ''
                  }}
                >
                  <option value="" disabled>
                    + ボード追加
                  </option>
                  {availableStatKindPresets.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              )}

              {CONDITION_PRESETS.length > 0 && (
                <select
                  className="condition-preset-select"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) handleApplyConditionPreset(e.target.value)
                    e.target.value = ''
                  }}
                >
                  <option value="" disabled>
                    条件プリセットを適用
                  </option>
                  {CONDITION_PRESETS.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}

              {rank.statKinds.length > 0 && (
                <button className="danger-button" onClick={handleClearConditions}>
                  条件クリア
                </button>
              )}
            </div>

            <div className="boards-column">
              {rank.statKinds.map((stat, i) => {
                const preset = STAT_KIND_PRESETS.find((p) => p.key === stat.label)

                return (
                  <div key={i} className="board-row">
                    <span className="board-label-pill">{preset?.label ?? stat.label}</span>
                    <button onClick={() => handleToggleContinuous(i)}>
                      {stat.continuous ? '共通' : '個別'}
                    </button>

                    {stat.continuous ? (
                      <div className="board-value-row">
                        <NumberInput
                          value={stat.cumulativeBorder?.[borderMode] ?? 0}
                          onChange={(v) => updateCumulativeBorderValue(i, borderMode, v)}
                          min={0}
                        />
                        <span>{preset?.comparisonSuffix ?? ''}</span>
                      </div>
                    ) : (
                      <div className="board-value-row-multi">
                        {rank.songSlots.map((_, songIndex) => (
                          <span key={songIndex} className="board-value-row">
                            <span className="song-badge">{songIndex + 1}曲目</span>
                            <NumberInput
                              value={stat.perSongBorders?.[songIndex]?.[borderMode] ?? 0}
                              onChange={(v) => updatePerSongBorderValue(i, songIndex, borderMode, v)}
                              min={0}
                            />
                            <span>{preset?.comparisonSuffix ?? ''}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    <button onClick={() => handleRemoveStatKind(i)}>削除</button>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

interface AddRankSelectProps {
  availableRankPresets: { name: string; index: number }[]
  onSelect: (value: string) => void
  label?: string
}

function AddRankSelect({ availableRankPresets, onSelect, label }: AddRankSelectProps): JSX.Element {
  return (
    <select
      defaultValue=""
      onChange={(e) => {
        onSelect(e.target.value)
        e.target.value = ''
      }}
    >
      <option value="" disabled>
        {label ?? '段位を追加'}
      </option>
      {availableRankPresets.map((p) => (
        <option key={p.name} value={p.name}>
          {p.index},{p.name}
        </option>
      ))}
      <option value={GAIDEN_OPTION_VALUE}>外伝を追加</option>
    </select>
  )
}

export default SetEditorScreen
