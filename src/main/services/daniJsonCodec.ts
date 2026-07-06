import { randomUUID } from 'crypto'
import { z } from 'zod'
import type { RawDaniJson } from '../../shared/types/daniJson'
import type { BorderValue, Rank, SongSlot, StatKind } from '../../shared/types/daniSet'
import { decodeUtf8WithOptionalBom, encodeUtf8WithBom } from './encoding'

const borderValueSchema = z.object({ red: z.number(), gold: z.number() })

const rawDaniJsonSchemaBase = z.object({
  title: z.string(),
  tja_Path: z.array(z.string()),
  tja_Diff: z.array(z.number()),
  tja_Genre: z.array(z.string()),
  tja_Hidden: z.array(z.boolean()),
  theme_Genre: z.array(z.string()),
  theme_Continuous: z.array(z.boolean()),
  theme_Gauge: z.object({ red: z.number(), gold: z.number() }),
  theme_Borders: z.array(z.object({ values: z.array(borderValueSchema) }))
})

export const rawDaniJsonSchema = rawDaniJsonSchemaBase.superRefine((data, ctx) => {
  const songCount = data.tja_Path.length

  for (const [key, arr] of [
    ['tja_Diff', data.tja_Diff],
    ['tja_Genre', data.tja_Genre],
    ['tja_Hidden', data.tja_Hidden]
  ] as const) {
    if (arr.length !== songCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${key} length (${arr.length}) does not match tja_Path length (${songCount})`,
        path: [key]
      })
    }
  }

  if (data.theme_Continuous.length !== data.theme_Genre.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'theme_Continuous length does not match theme_Genre length',
      path: ['theme_Continuous']
    })
  }
  if (data.theme_Borders.length !== data.theme_Genre.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'theme_Borders length does not match theme_Genre length',
      path: ['theme_Borders']
    })
  }

  data.theme_Borders.forEach((border, i) => {
    const continuous = data.theme_Continuous[i]
    if (continuous === undefined) return
    const expectedLength = continuous ? 1 : songCount
    if (border.values.length !== expectedLength) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `theme_Borders[${i}].values length (${border.values.length}) should be ${expectedLength} (continuous=${continuous})`,
        path: ['theme_Borders', i, 'values']
      })
    }
  })
})

export function readDaniJson(buf: Buffer): RawDaniJson {
  const parsed: unknown = JSON.parse(decodeUtf8WithOptionalBom(buf))
  return rawDaniJsonSchema.parse(parsed) as RawDaniJson
}

const RAW_DANI_JSON_KEY_ORDER = [
  'title',
  'tja_Path',
  'tja_Diff',
  'tja_Genre',
  'tja_Hidden',
  'theme_Genre',
  'theme_Continuous',
  'theme_Gauge',
  'theme_Borders'
] as const

export function writeDaniJson(raw: RawDaniJson): Buffer {
  const ordered: Record<string, unknown> = {}
  for (const key of RAW_DANI_JSON_KEY_ORDER) {
    ordered[key] = raw[key]
  }
  return encodeUtf8WithBom(JSON.stringify(ordered, null, 2))
}

const RANK_FOLDER_NAME_PATTERN = /^(\d+),(.+)$/

export function parseRankFolderName(folderName: string): { rankIndex: number; rankName: string } {
  const match = RANK_FOLDER_NAME_PATTERN.exec(folderName)
  if (!match) {
    throw new Error(`Rank folder name does not match "<index>,<name>" pattern: ${folderName}`)
  }
  return { rankIndex: Number(match[1]), rankName: match[2] }
}

export function folderNameForRank(rank: Pick<Rank, 'rankIndex' | 'rankName'>): string {
  return `${rank.rankIndex},${rank.rankName}`
}

export function toInternalRank(raw: RawDaniJson, folderName: string): Rank {
  const { rankIndex, rankName } = parseRankFolderName(folderName)

  const songSlots: SongSlot[] = raw.tja_Path.map((_, i) => ({
    id: randomUUID(),
    songId: null,
    diff: raw.tja_Diff[i],
    songGenreLabel: raw.tja_Genre[i],
    hidden: raw.tja_Hidden[i]
  }))

  const statKinds: StatKind[] = raw.theme_Genre.map((label, i) => {
    const continuous = raw.theme_Continuous[i]
    const values = raw.theme_Borders[i].values
    return continuous
      ? { label, continuous, cumulativeBorder: values[0] }
      : { label, continuous, perSongBorders: values }
  })

  return {
    id: randomUUID(),
    rankIndex,
    rankName,
    title: raw.title,
    gauge: raw.theme_Gauge,
    statKinds,
    songSlots
  }
}

/**
 * tjaPaths must be supplied by the caller (export pipeline), parallel to
 * rank.songSlots, since the internal model only stores a songId reference
 * while the on-disk relative path depends on where export placed the file.
 */
export function fromInternalRank(rank: Rank, tjaPaths: string[]): RawDaniJson {
  if (tjaPaths.length !== rank.songSlots.length) {
    throw new Error('tjaPaths length must match rank.songSlots length')
  }

  return {
    title: rank.title,
    tja_Path: tjaPaths,
    tja_Diff: rank.songSlots.map((slot) => slot.diff),
    tja_Genre: rank.songSlots.map((slot) => slot.songGenreLabel),
    tja_Hidden: rank.songSlots.map((slot) => slot.hidden),
    theme_Genre: rank.statKinds.map((stat) => stat.label),
    theme_Continuous: rank.statKinds.map((stat) => stat.continuous),
    theme_Gauge: rank.gauge,
    theme_Borders: rank.statKinds.map((stat) => ({
      values: stat.continuous
        ? [stat.cumulativeBorder as BorderValue]
        : (stat.perSongBorders as BorderValue[])
    }))
  }
}
