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
  songId: string | null
  diff: number
  songGenreLabel: string
  hidden: boolean
}

export interface Rank {
  id: string
  rankIndex: number
  rankName: string
  title: string
  gauge: BorderValue
  statKinds: StatKind[]
  songSlots: SongSlot[]
}

export interface DaniSet {
  id: string
  title: string
  index: number
  ranks: Rank[]
}

export interface DaniSetSummary {
  id: string
  title: string
  index: number
  rankCount: number
  updatedAt: string
}
