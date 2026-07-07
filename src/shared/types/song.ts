export type TjaBranch = 'N' | 'E' | 'M'

export interface SongCourseBranchAnalysis {
  /** Count of plain don/katsu notes (TJA note types 1-4) only. */
  donKatsuCount: number
  /** Duration (seconds) of each normal roll (note types 5/6) segment. */
  rollDurations: number[]
  /** Hit target for each balloon(7)/kusudama(9) note, from the branch's own BALLOON* header. */
  balloonHits: number[]
}

export interface SongCourse {
  course: string
  level: number | null
  noteCount: number
  balloonCounts: number[] | null
  scoreInit: number | null
  scoreDiff: number | null
  /** True when this course uses #BRANCHSTART with a non-N branch that has notes. */
  hasBranches: boolean
  /** Which branch to analyze by default: 達人(M) > 玄人(E) > 普通(N), whichever hardest has notes. */
  defaultBranch: TjaBranch
  /** Only contains an entry for a branch if it has note content (N is always present). */
  branches: Partial<Record<TjaBranch, SongCourseBranchAnalysis>>
}

/** Result of picking a .tja file and copying it (with its resolved .ogg) into local storage. */
export interface SongAssetResult {
  tjaRelPath: string
  oggRelPath: string
  songTitle: string
  courses: SongCourse[]
}
