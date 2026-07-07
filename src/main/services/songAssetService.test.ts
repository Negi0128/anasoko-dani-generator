import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assignSongFile } from './songAssetService'

describe('songAssetService', () => {
  let workDir: string
  let songsDir: string
  let tjaPath: string
  let oggPath: string

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'anasoko-songasset-'))
    songsDir = join(workDir, 'songs')

    tjaPath = join(workDir, 'source.tja')
    oggPath = join(workDir, 'source.ogg')
    writeFileSync(
      tjaPath,
      ['TITLE:テスト曲', 'BPM:150', 'WAVE:source.ogg', 'COURSE:Oni', 'LEVEL:8', '#START', '1234,', '#END'].join(
        '\r\n'
      )
    )
    writeFileSync(oggPath, Buffer.from([0x01, 0x02, 0x03, 0x04]))
  })

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true })
  })

  it('copies the tja+ogg pair into its own folder and parses metadata', () => {
    const result = assignSongFile(songsDir, tjaPath)

    expect(result.songTitle).toBe('テスト曲')
    expect(result.courses).toEqual([
      {
        course: 'Oni',
        level: 8,
        noteCount: 4,
        balloonCounts: null,
        scoreInit: null,
        scoreDiff: null,
        hasBranches: false,
        defaultBranch: 'N',
        branches: { N: { donKatsuCount: 4, rollDurations: [], balloonHits: [] } }
      }
    ])

    expect(readFileSync(join(workDir, result.tjaRelPath), 'utf-8')).toBe(readFileSync(tjaPath, 'utf-8'))
    expect(readFileSync(join(workDir, result.oggRelPath))).toEqual(readFileSync(oggPath))
  })

  it('creates a separate copy for every assignment, even of the same source file', () => {
    const first = assignSongFile(songsDir, tjaPath)
    const second = assignSongFile(songsDir, tjaPath)

    expect(first.tjaRelPath).not.toBe(second.tjaRelPath)
  })

  it('throws when the tja has no WAVE: header', () => {
    const noWavePath = join(workDir, 'nowave.tja')
    writeFileSync(noWavePath, ['TITLE:曲', 'COURSE:Oni', '#START', '1,', '#END'].join('\r\n'))
    expect(() => assignSongFile(songsDir, noWavePath)).toThrow(/WAVE/)
  })
})
