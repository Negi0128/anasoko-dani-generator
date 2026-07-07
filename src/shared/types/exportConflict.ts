export interface ExportedRankSummary {
  rankIndex: number
  rankName: string
  title: string
  songTitles: string[]
  gauge: { red: number; gold: number }
  statKindLabels: string[]
}

/** Returned when a Dani export destination already has a numbered folder for
 * the same set title, so the UI can ask whether to overwrite it. */
export interface ExportFolderConflict {
  folderName: string
  before: ExportedRankSummary[]
  after: ExportedRankSummary[]
}
