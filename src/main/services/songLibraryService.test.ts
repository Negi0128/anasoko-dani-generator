import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from './db'
import {
  findSongByHash,
  getSong,
  importSong,
  listSongs,
  removeSong
} from './songLibraryService'
import type Database from 'better-sqlite3'

describe('songLibraryService', () => {
  let db: Database.Database
  let workDir: string
  let songsDir: string
  let tjaPath: string
  let oggPath: string

  beforeEach(() => {
    db = openDatabase(':memory:')
    workDir = mkdtempSync(join(tmpdir(), 'anasoko-songlib-'))
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
    db.close()
    rmSync(workDir, { recursive: true, force: true })
  })

  it('imports a tja+ogg pair, parses metadata, and copies files into the library', () => {
    const song = importSong(db, songsDir, tjaPath)

    expect(song.title).toBe('テスト曲')
    expect(song.bpm).toBe(150)
    expect(song.courses).toEqual([
      {
        course: 'Oni',
        level: 8,
        noteCount: 4,
        balloonCounts: null,
        scoreInit: null,
        scoreDiff: null
      }
    ])

    const copiedTja = join(songsDir, song.id, 'chart.tja')
    const copiedOgg = join(songsDir, song.id, 'audio.ogg')
    expect(readFileSync(copiedTja, 'utf-8')).toBe(readFileSync(tjaPath, 'utf-8'))
    expect(readFileSync(copiedOgg)).toEqual(readFileSync(oggPath))
  })

  it('deduplicates re-imports of the same tja+ogg content by hash', () => {
    const first = importSong(db, songsDir, tjaPath)
    const second = importSong(db, songsDir, tjaPath)

    expect(second.id).toBe(first.id)
    expect(listSongs(db)).toHaveLength(1)
  })

  it('finds a song by its content hash', () => {
    const song = importSong(db, songsDir, tjaPath)
    expect(findSongByHash(db, song.contentHash)?.id).toBe(song.id)
    expect(findSongByHash(db, 'nonexistent-hash')).toBeNull()
  })

  it('blocks removal when the song is referenced by a song slot, unless forced', () => {
    const song = importSong(db, songsDir, tjaPath)

    db.prepare(
      `INSERT INTO dani_sets (id, title, set_index, created_at, updated_at) VALUES ('set1', 'Set', 0, '', '')`
    ).run()
    db.prepare(
      `INSERT INTO ranks (id, set_id, sort_order, rank_index, rank_name, gauge_red, gauge_gold)
       VALUES ('rank1', 'set1', 0, 0, '五級', 98, 100)`
    ).run()
    db.prepare(
      `INSERT INTO song_slots (id, rank_id, sort_order, song_id, diff, song_genre_label, hidden)
       VALUES ('slot1', 'rank1', 0, ?, 3, '', 0)`
    ).run(song.id)

    const blocked = removeSong(db, songsDir, song.id)
    expect(blocked).toEqual({ ok: false, blockedBySlots: 1 })
    expect(getSong(db, song.id)).not.toBeNull()

    const forced = removeSong(db, songsDir, song.id, true)
    expect(forced.ok).toBe(true)
    expect(getSong(db, song.id)).toBeNull()
  })

  it('removes an unreferenced song and deletes its files', () => {
    const song = importSong(db, songsDir, tjaPath)
    const result = removeSong(db, songsDir, song.id)
    expect(result).toEqual({ ok: true, blockedBySlots: 0 })
    expect(getSong(db, song.id)).toBeNull()
  })
})
