import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3'
import type { DaniSet, DaniSetSummary, Rank, SongSlot, StatKind } from '../../shared/types/daniSet'

interface DaniSetRow {
  id: string
  title: string
  set_index: number
}

interface RankRow {
  id: string
  rank_index: number
  rank_name: string
  title: string
  gauge_red: number
  gauge_gold: number
}

interface StatKindRow {
  id: string
  label: string
  continuous: number
  cumulative_red: number | null
  cumulative_gold: number | null
}

interface SongSlotRow {
  id: string
  tja_rel_path: string | null
  ogg_rel_path: string | null
  song_title: string | null
  courses_json: string | null
  diff: number
  song_genre_label: string
  hidden: number
  analysis_branch: string | null
}

export function listSets(db: Database.Database): DaniSetSummary[] {
  const rows = db
    .prepare(
      `SELECT s.id, s.title, s.set_index as idx, s.updated_at as updatedAt,
              (SELECT COUNT(*) FROM ranks r WHERE r.set_id = s.id) as rankCount
       FROM dani_sets s ORDER BY s.set_index`
    )
    .all() as { id: string; title: string; idx: number; updatedAt: string; rankCount: number }[]

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    index: r.idx,
    rankCount: r.rankCount,
    updatedAt: r.updatedAt
  }))
}

export function createSet(db: Database.Database, input: { title: string; index: number }): DaniSet {
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO dani_sets (id, title, set_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
  ).run(id, input.title, input.index, now, now)
  return { id, title: input.title, index: input.index, ranks: [] }
}

export function loadSet(db: Database.Database, id: string): DaniSet | null {
  const setRow = db.prepare('SELECT * FROM dani_sets WHERE id = ?').get(id) as DaniSetRow | undefined
  if (!setRow) return null

  const rankRows = db
    .prepare('SELECT * FROM ranks WHERE set_id = ? ORDER BY sort_order')
    .all(id) as RankRow[]

  const ranks: Rank[] = rankRows.map((rankRow) => {
    const statKindRows = db
      .prepare('SELECT * FROM stat_kinds WHERE rank_id = ? ORDER BY sort_order')
      .all(rankRow.id) as StatKindRow[]

    const statKinds: StatKind[] = statKindRows.map((sk) => {
      if (sk.continuous) {
        return {
          label: sk.label,
          continuous: true,
          cumulativeBorder: { red: sk.cumulative_red as number, gold: sk.cumulative_gold as number }
        }
      }
      const perSongRows = db
        .prepare(
          'SELECT red, gold FROM stat_kind_per_song_borders WHERE stat_kind_id = ? ORDER BY song_slot_index'
        )
        .all(sk.id) as { red: number; gold: number }[]
      return {
        label: sk.label,
        continuous: false,
        perSongBorders: perSongRows.map((v) => ({ red: v.red, gold: v.gold }))
      }
    })

    const slotRows = db
      .prepare('SELECT * FROM song_slots WHERE rank_id = ? ORDER BY sort_order')
      .all(rankRow.id) as SongSlotRow[]

    const songSlots: SongSlot[] = slotRows.map((s) => ({
      id: s.id,
      tjaRelPath: s.tja_rel_path,
      oggRelPath: s.ogg_rel_path,
      songTitle: s.song_title,
      courses: s.courses_json ? JSON.parse(s.courses_json) : [],
      diff: s.diff,
      songGenreLabel: s.song_genre_label,
      hidden: !!s.hidden,
      analysisBranch: (s.analysis_branch as SongSlot['analysisBranch']) ?? null
    }))

    return {
      id: rankRow.id,
      rankIndex: rankRow.rank_index,
      rankName: rankRow.rank_name,
      title: rankRow.title,
      gauge: { red: rankRow.gauge_red, gold: rankRow.gauge_gold },
      statKinds,
      songSlots
    }
  })

  return { id: setRow.id, title: setRow.title, index: setRow.set_index, ranks }
}

/** Full-tree replace: simplest correct way to persist edits made client-side on the whole DaniSet object. */
export function saveSet(db: Database.Database, set: DaniSet): void {
  const now = new Date().toISOString()

  const run = db.transaction(() => {
    db.prepare('UPDATE dani_sets SET title = ?, set_index = ?, updated_at = ? WHERE id = ?').run(
      set.title,
      set.index,
      now,
      set.id
    )
    db.prepare('DELETE FROM ranks WHERE set_id = ?').run(set.id)

    const insertRank = db.prepare(
      `INSERT INTO ranks (id, set_id, sort_order, rank_index, rank_name, title, gauge_red, gauge_gold)
       VALUES (@id, @setId, @sortOrder, @rankIndex, @rankName, @title, @gaugeRed, @gaugeGold)`
    )
    const insertStatKind = db.prepare(
      `INSERT INTO stat_kinds (id, rank_id, sort_order, label, continuous, cumulative_red, cumulative_gold)
       VALUES (@id, @rankId, @sortOrder, @label, @continuous, @cumRed, @cumGold)`
    )
    const insertBorder = db.prepare(
      `INSERT INTO stat_kind_per_song_borders (stat_kind_id, song_slot_index, red, gold) VALUES (?, ?, ?, ?)`
    )
    const insertSlot = db.prepare(
      `INSERT INTO song_slots (id, rank_id, sort_order, tja_rel_path, ogg_rel_path, song_title, courses_json, diff, song_genre_label, hidden, analysis_branch)
       VALUES (@id, @rankId, @sortOrder, @tjaRelPath, @oggRelPath, @songTitle, @coursesJson, @diff, @songGenreLabel, @hidden, @analysisBranch)`
    )

    set.ranks.forEach((rank, rankOrder) => {
      insertRank.run({
        id: rank.id,
        setId: set.id,
        sortOrder: rankOrder,
        rankIndex: rank.rankIndex,
        rankName: rank.rankName,
        title: rank.title,
        gaugeRed: rank.gauge.red,
        gaugeGold: rank.gauge.gold
      })

      rank.statKinds.forEach((stat, statOrder) => {
        const statId = randomUUID()
        insertStatKind.run({
          id: statId,
          rankId: rank.id,
          sortOrder: statOrder,
          label: stat.label,
          continuous: stat.continuous ? 1 : 0,
          cumRed: stat.continuous ? (stat.cumulativeBorder?.red ?? null) : null,
          cumGold: stat.continuous ? (stat.cumulativeBorder?.gold ?? null) : null
        })
        if (!stat.continuous && stat.perSongBorders) {
          stat.perSongBorders.forEach((border, i) => {
            insertBorder.run(statId, i, border.red, border.gold)
          })
        }
      })

      rank.songSlots.forEach((slot, slotOrder) => {
        insertSlot.run({
          id: slot.id,
          rankId: rank.id,
          sortOrder: slotOrder,
          tjaRelPath: slot.tjaRelPath,
          oggRelPath: slot.oggRelPath,
          songTitle: slot.songTitle,
          coursesJson: slot.courses.length > 0 ? JSON.stringify(slot.courses) : null,
          diff: slot.diff,
          songGenreLabel: slot.songGenreLabel,
          hidden: slot.hidden ? 1 : 0,
          analysisBranch: slot.analysisBranch
        })
      })
    })
  })

  run()
}

export function deleteSet(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM dani_sets WHERE id = ?').run(id)
}

export function duplicateSet(db: Database.Database, id: string, newTitle: string): DaniSet | null {
  const original = loadSet(db, id)
  if (!original) return null

  const maxIndex = listSets(db).reduce((max, s) => Math.max(max, s.index), -1)
  const created = createSet(db, { title: newTitle, index: maxIndex + 1 })

  const cloned: DaniSet = {
    ...created,
    ranks: original.ranks.map((rank) => ({
      ...rank,
      id: randomUUID(),
      songSlots: rank.songSlots.map((slot) => ({ ...slot, id: randomUUID() }))
    }))
  }
  saveSet(db, cloned)
  return loadSet(db, cloned.id)
}
