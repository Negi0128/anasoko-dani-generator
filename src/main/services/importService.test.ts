import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from './db'
import { writeDaniDef } from './daniDefCodec'
import { importSetFromFolder, importSetFromZip } from './importService'
import { loadSet } from './setService'
import { listSongs } from './songLibraryService'

function writeMinimalSet(rootDir: string): void {
  writeFileSync(join(rootDir, 'dani.def'), writeDaniDef({ title: 'テストセット', index: 0 }))

  const rankDir = join(rootDir, '0,五級')
  const fumenDir = join(rankDir, 'fumen')
  mkdirSync(fumenDir, { recursive: true })

  writeFileSync(
    join(fumenDir, '曲A.tja'),
    ['TITLE:曲A', 'BPM:150', 'WAVE:曲A.ogg', 'COURSE:Oni', 'LEVEL:8', '#START', '1234,', '#END'].join('\r\n')
  )
  writeFileSync(join(fumenDir, '曲A.ogg'), Buffer.from([0x01, 0x02]))

  writeFileSync(
    join(rankDir, 'dani.json'),
    JSON.stringify({
      title: '',
      tja_Path: ['fumen\\曲A.tja'],
      tja_Diff: [3],
      tja_Genre: [''],
      tja_Hidden: [false],
      theme_Genre: ['HitCount'],
      theme_Continuous: [true],
      theme_Gauge: { red: 98, gold: 100 },
      theme_Borders: [{ values: [{ red: 100, gold: 120 }] }]
    })
  )
}

describe('importSetFromFolder', () => {
  let db: Database.Database
  let userDataDir: string
  let songsDir: string
  let sourceDir: string

  beforeEach(() => {
    db = openDatabase(':memory:')
    userDataDir = mkdtempSync(join(tmpdir(), 'anasoko-import-userdata-'))
    songsDir = join(userDataDir, 'songs')
    sourceDir = mkdtempSync(join(tmpdir(), 'anasoko-import-source-'))
  })

  afterEach(() => {
    db.close()
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(sourceDir, { recursive: true, force: true })
  })

  it('imports a minimal set folder end-to-end', () => {
    writeMinimalSet(sourceDir)

    const report = importSetFromFolder(db, songsDir, sourceDir)
    expect(report.ranksImported).toBe(1)
    expect(report.songsAdded).toBe(1)
    expect(report.warnings).toEqual([])

    const set = loadSet(db, report.setId)
    expect(set?.title).toBe('テストセット')
    expect(set?.ranks[0].rankName).toBe('五級')
    expect(set?.ranks[0].songSlots[0].songId).not.toBeNull()
    expect(listSongs(db)).toHaveLength(1)
  })

  it('reports a warning and skips a rank when dani.json is missing', () => {
    writeMinimalSet(sourceDir)
    rmSync(join(sourceDir, '0,五級', 'dani.json'))

    const report = importSetFromFolder(db, songsDir, sourceDir)
    expect(report.ranksImported).toBe(0)
    expect(report.warnings.some((w) => w.includes('dani.json'))).toBe(true)
  })

  it('throws a clear error when dani.def is missing entirely', () => {
    expect(() => importSetFromFolder(db, songsDir, sourceDir)).toThrow(/dani\.def/)
  })
})

describe('importSetFromZip (real reference sample)', () => {
  let db: Database.Database
  let userDataDir: string
  let songsDir: string

  beforeEach(() => {
    db = openDatabase(':memory:')
    userDataDir = mkdtempSync(join(tmpdir(), 'anasoko-import-real-'))
    songsDir = join(userDataDir, 'songs')
  })

  afterEach(() => {
    db.close()
    rmSync(userDataDir, { recursive: true, force: true })
  })

  it('imports the real Anasoko sample zip end-to-end', async () => {
    const zipPath = join(process.cwd(), 'reference', '段位サンプルファイル.zip')
    const report = await importSetFromZip(db, songsDir, zipPath)

    // 18 ranks exist in the sample (indices 0-17); tolerate the one known
    // malformed folder-name entry in the real archive being skipped.
    expect(report.ranksImported).toBeGreaterThanOrEqual(15)
    expect(report.songsAdded).toBeGreaterThan(0)

    const set = loadSet(db, report.setId)
    expect(set?.title).toBe('2025本家段位')

    const rank0 = set?.ranks.find((r) => r.rankIndex === 0)
    expect(rank0?.rankName).toBe('五級')
    expect(rank0?.songSlots.every((s) => s.songId !== null)).toBe(true)
  }, 60000)
})
