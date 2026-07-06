/**
 * Fixed rank name progression confirmed by the user: index 0-17 matches the
 * sample set exactly (五級..超人), index 18 is 達人. Index 19+ is the
 * open-ended 外伝 category — the user adds as many as needed with their own
 * numbering/naming, so it has no fixed preset entry here.
 */
export const RANK_NAME_PRESETS: readonly string[] = [
  '五級',
  '四級',
  '三級',
  '二級',
  '一級',
  '初段',
  '二段',
  '三段',
  '四段',
  '五段',
  '六段',
  '七段',
  '八段',
  '九段',
  '十段',
  '玄人',
  '名人',
  '超人',
  '達人'
]

export const GAIDEN_START_INDEX = 19
