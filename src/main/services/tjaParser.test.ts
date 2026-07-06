import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { parseTja } from './tjaParser'

const fixture = (name: string): Buffer => readFileSync(join(__dirname, '__fixtures__', name))

describe('parseTja', () => {
  it('parses a UTF-8 BOM encoded TJA and extracts headers', () => {
    const result = parseTja(fixture('utf8-bom-sample.tja'))
    expect(result.encodingUsed).toBe('utf8-bom')
    expect(result.title).toBe('はいよろこんで')
    expect(result.bpm).toBe(147)
    expect(result.wave).toBe('はいよろこんで.ogg')
    expect(result.courses.length).toBeGreaterThan(0)
    for (const course of result.courses) {
      expect(course.noteCount).toBeGreaterThan(0)
    }
  })

  it('parses a cp932 (Shift-JIS) encoded TJA with a Japanese title', () => {
    const result = parseTja(fixture('cp932-sample.tja'))
    expect(result.encodingUsed).toBe('cp932')
    expect(result.title).toBe('ライラック')
    expect(result.courses.length).toBeGreaterThan(0)
  })

  it('parses a cp932 encoded TJA with an ASCII title', () => {
    const result = parseTja(fixture('cp932-ascii-title-sample.tja'))
    expect(result.title).toBe('Crystal Hail')
    expect(result.courses.length).toBeGreaterThan(0)
    const totalNotes = result.courses.reduce((sum, c) => sum + c.noteCount, 0)
    expect(totalNotes).toBeGreaterThan(0)
  })

  it('does not count digits inside command lines as notes', () => {
    const tja = Buffer.from(
      [
        'TITLE:Test',
        'BPM:120',
        'COURSE:Oni',
        'LEVEL:8',
        '#START',
        '1234,',
        '#BPMCHANGE 150',
        '5678,',
        '#END'
      ].join('\r\n'),
      'utf-8'
    )
    const result = parseTja(tja)
    expect(result.courses).toHaveLength(1)
    expect(result.courses[0].noteCount).toBe(8)
  })
})
