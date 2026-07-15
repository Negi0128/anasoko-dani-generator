import type { SongCourse, TjaBranch } from './song'

export interface BorderValue {
  red: number
  gold: number
}

export interface StatKind {
  label: string
  continuous: boolean
  /** present iff continuous === true: single cumulative target across the whole rank */
  cumulativeBorder?: BorderValue
  /** present iff continuous === false: one target per song, parallel to songSlots order */
  perSongBorders?: BorderValue[]
}

export interface SongSlot {
  id: string
  tjaRelPath: string | null
  oggRelPath: string | null
  songTitle: string | null
  courses: SongCourse[]
  diff: number
  songGenreLabel: string
  hidden: boolean
  /** User-chosen branch to reference for analysis; null = use the course's own defaultBranch. */
  analysisBranch: TjaBranch | null
}

export interface Rank {
  id: string
  rankIndex: number
  rankName: string
  /** dani.json's title. Always mirrors rankName — it is derived, not edited
   * independently, so the on-screen title always matches the rank panel. */
  title: string
  gauge: BorderValue
  statKinds: StatKind[]
  songSlots: SongSlot[]
}

export interface DaniSet {
  id: string
  title: string
  index: number
  /** Absolute path of the folder this set was last exported to, or null if it
   * has never been exported. Re-exporting overwrites this folder in place. */
  lastExportPath: string | null
  ranks: Rank[]
}

export interface DaniSetSummary {
  id: string
  title: string
  index: number
  rankCount: number
  updatedAt: string
}
