/** tja_Diff index (0-4) <-> display label, matching Anasoko's course convention. */
export const COURSE_LABELS: readonly string[] = ['かんたん', 'ふつう', 'むずかしい', 'おに', '裏譜面']

const COURSE_NAME_TO_INDEX: Record<string, number> = {
  easy: 0,
  かんたん: 0,
  normal: 1,
  ふつう: 1,
  hard: 2,
  むずかしい: 2,
  oni: 3,
  おに: 3,
  edit: 4,
  ura: 4,
  裏: 4,
  master: 4
}

export function courseNameToIndex(courseName: string): number | null {
  const trimmed = courseName.trim()
  // TJA spec also allows COURSE: to be a bare number (0-4), not just a name.
  if (/^[0-4]$/.test(trimmed)) return Number(trimmed)
  const index = COURSE_NAME_TO_INDEX[trimmed.toLowerCase()]
  return index === undefined ? null : index
}
