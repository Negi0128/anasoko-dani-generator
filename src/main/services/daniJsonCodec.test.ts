import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  fromInternalRank,
  parseRankFolderName,
  readDaniJson,
  toInternalRank,
  writeDaniJson
} from './daniJsonCodec'

const fixture = (name: string): Buffer => readFileSync(join(__dirname, '__fixtures__', name))

describe('parseRankFolderName', () => {
  it('splits "<index>,<name>" folder names', () => {
    expect(parseRankFolderName('5,初段')).toEqual({ rankIndex: 5, rankName: '初段' })
  })

  it('throws on folder names without the expected pattern', () => {
    expect(() => parseRankFolderName('not-a-rank-folder')).toThrow()
  })
})

describe('readDaniJson', () => {
  it('parses a single-continuous-stat rank (0,五級)', () => {
    const raw = readDaniJson(fixture('rank-single-stat.dani.json'))
    expect(raw.theme_Genre).toEqual(['HitCount'])
    expect(raw.theme_Continuous).toEqual([true])
    expect(raw.theme_Borders).toHaveLength(1)
    expect(raw.theme_Borders[0].values).toHaveLength(1)
    expect(raw.tja_Path).toHaveLength(3)
  })

  it('parses a mixed-continuity rank (12,八段) where Roll is per-song', () => {
    const raw = readDaniJson(fixture('rank-mixed-continuous.dani.json'))
    expect(raw.theme_Genre).toEqual(['Good', 'Miss', 'Roll'])
    expect(raw.theme_Continuous).toEqual([true, true, false])
    expect(raw.theme_Borders.map((b) => b.values.length)).toEqual([1, 1, 3])
  })

  it('rejects a payload where a non-continuous stat has the wrong border count', () => {
    const malformed = {
      title: '',
      tja_Path: ['a.tja', 'b.tja'],
      tja_Diff: [3, 3],
      tja_Genre: ['g1', 'g2'],
      tja_Hidden: [false, false],
      theme_Genre: ['Roll'],
      theme_Continuous: [false],
      theme_Gauge: { red: 98, gold: 100 },
      theme_Borders: [{ values: [{ red: 1, gold: 2 }] }] // should have 2 values (one per song), not 1
    }
    const buf = Buffer.from(JSON.stringify(malformed), 'utf-8')
    expect(() => readDaniJson(buf)).toThrow()
  })
})

describe('toInternalRank / fromInternalRank round trip', () => {
  it('round-trips the single-stat fixture losslessly', () => {
    const raw = readDaniJson(fixture('rank-single-stat.dani.json'))
    const rank = toInternalRank(raw, '0,五級')

    expect(rank.rankIndex).toBe(0)
    expect(rank.rankName).toBe('五級')
    expect(rank.statKinds).toEqual([
      { label: 'HitCount', continuous: true, cumulativeBorder: raw.theme_Borders[0].values[0] }
    ])

    const rebuilt = fromInternalRank(rank, raw.tja_Path)
    expect(rebuilt).toEqual(raw)
  })

  it('round-trips the mixed-continuity fixture losslessly, including per-song Roll borders', () => {
    const raw = readDaniJson(fixture('rank-mixed-continuous.dani.json'))
    const rank = toInternalRank(raw, '12,八段')

    const rollStat = rank.statKinds.find((s) => s.label === 'Roll')
    expect(rollStat?.continuous).toBe(false)
    expect(rollStat?.perSongBorders).toHaveLength(3)

    const rebuilt = fromInternalRank(rank, raw.tja_Path)
    expect(rebuilt).toEqual(raw)
  })
})

describe('writeDaniJson', () => {
  it('produces UTF-8 with a leading BOM and stable key order', () => {
    const raw = readDaniJson(fixture('rank-single-stat.dani.json'))
    const buf = writeDaniJson(raw)

    expect(buf.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]))

    const text = buf.subarray(3).toString('utf-8')
    const keys = Object.keys(JSON.parse(text))
    expect(keys).toEqual([
      'title',
      'tja_Path',
      'tja_Diff',
      'tja_Genre',
      'tja_Hidden',
      'theme_Genre',
      'theme_Continuous',
      'theme_Gauge',
      'theme_Borders'
    ])
  })

  it('round-trips write -> read to an equal object', () => {
    const raw = readDaniJson(fixture('rank-mixed-continuous.dani.json'))
    expect(readDaniJson(writeDaniJson(raw))).toEqual(raw)
  })
})
