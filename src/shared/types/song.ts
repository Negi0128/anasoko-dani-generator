export interface SongCourse {
  course: string
  level: number | null
  noteCount: number
  balloonCounts: number[] | null
  scoreInit: number | null
  scoreDiff: number | null
}

export interface Song {
  id: string
  title: string
  subtitle: string | null
  contentHash: string
  tjaStoredPath: string
  oggStoredPath: string
  tjaEncoding: string
  bpm: number | null
  waveFilenameInTja: string | null
  createdAt: string
  updatedAt: string
  courses: SongCourse[]
}

export interface RemoveSongResult {
  ok: boolean
  blockedBySlots: number
}
