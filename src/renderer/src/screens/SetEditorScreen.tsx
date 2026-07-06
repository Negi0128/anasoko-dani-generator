import { useEffect, useState } from 'react'
import type { DaniSet, Rank, SongSlot, StatKind } from '../../../shared/types/daniSet'
import type { Song } from '../../../shared/types/song'
import { GAIDEN_START_INDEX, RANK_NAME_PRESETS } from '../../../shared/types/rankPresets'
import { STAT_KIND_PRESETS } from '../../../shared/types/statKindPresets'
import { COURSE_LABELS, courseNameToIndex } from '../../../shared/types/coursePresets'
import SongPickerModal from '../components/SongPickerModal'
import NumberInput from '../components/NumberInput'

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
      songId: null,
      diff: 3,
      songGenreLabel: '',
      hidden: false
    }))
  }
}

function highestAvailableCourseIndex(song: Song): number {
  const indexes = song.courses
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

function SetEditorScreen({ setId, onBack }: SetEditorScreenProps): JSX.Element {
  const [set, setSet] = useState<DaniSet | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [songsById, setSongsById] = useState<Record<string, Song>>({})
  const [pickerTargetSlotId, setPickerTargetSlotId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [borderMode, setBorderMode] = useState<BorderMode>('red')

  useEffect(() => {
    window.api.sets.load(setId).then(setSet)
    window.api.songLibrary.list().then((songs) => {
      setSongsById(Object.fromEntries(songs.map((s) => [s.id, s])))
    })
  }, [setId])

  const rank = set?.ranks[currentIndex] ?? null
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
      const name = window.prompt('外伝の名前を入力', `外伝${gaidenCount + 1}`)
      if (name && name.trim()) handleAddGaidenRank(name.trim())
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

  const updateGaugeValue = (mode: BorderMode, value: number): void => {
    updateRank((r) => ({ ...r, gauge: { ...r.gauge, [mode]: value } }))
  }

  const updateSongSlot = (slotId: string, patch: Partial<SongSlot>): void => {
    updateRank((r) => ({
      ...r,
      songSlots: r.songSlots.map((slot) => (slot.id === slotId ? { ...slot, ...patch } : slot))
    }))
  }

  const handleSave = async (): Promise<void> => {
    if (!set) return
    setSaving(true)
    try {
      const saved = await window.api.sets.save(set)
      if (saved) setSet(saved)
    } finally {
      setSaving(false)
    }
  }

  if (!set) return <p>読み込み中...</p>

  const isGaidenRank = rank ? rank.rankIndex >= GAIDEN_START_INDEX : false

  return (
    <div className={`rank-editor-fullscreen border-mode-${borderMode}`}>
      <div className="rank-editor-topbar">
        <button onClick={onBack}>← 段位道場一覧</button>
        <button onClick={handleSave} disabled={saving}>
          保存
        </button>
      </div>

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
          {isGaidenRank && (
            <input
              className="rank-title-pill"
              type="text"
              placeholder="この段位のタイトル"
              value={rank.title}
              onChange={(e) => updateRank((r) => ({ ...r, title: e.target.value }))}
            />
          )}

          <div className="rank-editor-main">
            <div className="song-list-panel">
              {rank.songSlots.map((slot, i) => {
                const assignedSong = slot.songId ? songsById[slot.songId] : undefined
                const availableCourseIndexes = assignedSong
                  ? assignedSong.courses
                      .map((c) => courseNameToIndex(c.course))
                      .filter((idx): idx is number => idx !== null)
                  : []

                return (
                  <div key={slot.id} className="song-row">
                    <span className={`order-badge order-${i}`}>{['1st', '2nd', '3rd'][i]}</span>
                    <button className="song-title-btn" onClick={() => setPickerTargetSlotId(slot.id)}>
                      {assignedSong ? assignedSong.title : 'クリックして曲を選択'}
                    </button>
                    <select
                      className="course-select"
                      value={slot.diff}
                      disabled={!assignedSong}
                      onChange={(e) => updateSongSlot(slot.id, { diff: Number(e.target.value) })}
                    >
                      {COURSE_LABELS.map((label, idx) => (
                        <option
                          key={idx}
                          value={idx}
                          disabled={assignedSong ? !availableCourseIndexes.includes(idx) : false}
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
                <div className="rank-badge">
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

          <div className="boards-section">
            <div className="boards-toolbar">
              <button
                className={`border-mode-button ${borderMode}`}
                onClick={() => setBorderMode((m) => (m === 'red' ? 'gold' : 'red'))}
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
                />
                <span>% 以上</span>
              </div>

              {availableStatKindPresets.length > 0 && rank.statKinds.length < MAX_STAT_KINDS && (
                <select
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

      {pickerTargetSlotId && rank && (
        <SongPickerModal
          onClose={() => setPickerTargetSlotId(null)}
          onSelect={(song) => {
            updateSongSlot(pickerTargetSlotId, { songId: song.id, diff: highestAvailableCourseIndex(song) })
            setSongsById((prev) => ({ ...prev, [song.id]: song }))
            setPickerTargetSlotId(null)
          }}
        />
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
