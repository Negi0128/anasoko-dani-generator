import { createHash, randomUUID } from 'crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'fs'
import { dirname, join } from 'path'
import type Database from 'better-sqlite3'
import type { RemoveSongResult, Song } from '../../shared/types/song'
import { parseTja, TjaParseResult } from './tjaParser'

/**
 * Anasoko requires the .ogg to live alongside its .tja, so we only ask the
 * user to pick the .tja and resolve the audio file ourselves from the
 * chart's own WAVE: header, matching how the simulator itself locates it.
 */
function resolveOggPath(tjaSourcePath: string, parsed: TjaParseResult): string {
  if (!parsed.wave) {
    throw new Error('TJAファイルにWAVE:の指定が見つかりませんでした')
  }
  const oggPath = join(dirname(tjaSourcePath), parsed.wave)
  if (!existsSync(oggPath)) {
    throw new Error(`WAVE:で指定された音源ファイルが見つかりません: ${oggPath}`)
  }
  return oggPath
}

interface SongRowRaw {
  id: string
  title: string
  subtitle: string | null
  content_hash: string
  tja_stored_path: string
  ogg_stored_path: string
  tja_encoding: string
  bpm: number | null
  wave_filename_in_tja: string | null
  created_at: string
  updated_at: string
}

interface SongCourseRowRaw {
  course: string
  level: number | null
  note_count: number
  balloon_counts: string | null
  score_init: number | null
  score_diff: number | null
}

function computeContentHash(tjaBuf: Buffer, oggBuf: Buffer): string {
  return createHash('sha256').update(tjaBuf).update(oggBuf).digest('hex')
}

function rowToSong(db: Database.Database, row: SongRowRaw): Song {
  const courseRows = db
    .prepare('SELECT * FROM song_courses WHERE song_id = ?')
    .all(row.id) as SongCourseRowRaw[]

  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    contentHash: row.content_hash,
    tjaStoredPath: row.tja_stored_path,
    oggStoredPath: row.ogg_stored_path,
    tjaEncoding: row.tja_encoding,
    bpm: row.bpm,
    waveFilenameInTja: row.wave_filename_in_tja,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    courses: courseRows.map((c) => ({
      course: c.course,
      level: c.level,
      noteCount: c.note_count,
      balloonCounts: c.balloon_counts ? (JSON.parse(c.balloon_counts) as number[]) : null,
      scoreInit: c.score_init,
      scoreDiff: c.score_diff
    }))
  }
}

export function findSongByHash(db: Database.Database, contentHash: string): Song | null {
  const row = db.prepare('SELECT * FROM songs WHERE content_hash = ?').get(contentHash) as
    | SongRowRaw
    | undefined
  return row ? rowToSong(db, row) : null
}

export function getSong(db: Database.Database, id: string): Song | null {
  const row = db.prepare('SELECT * FROM songs WHERE id = ?').get(id) as SongRowRaw | undefined
  return row ? rowToSong(db, row) : null
}

export function listSongs(db: Database.Database): Song[] {
  const rows = db.prepare('SELECT * FROM songs ORDER BY title').all() as SongRowRaw[]
  return rows.map((row) => rowToSong(db, row))
}

/**
 * Imports a tja into the shared library. The paired .ogg is resolved
 * automatically from the chart's own WAVE: header (same directory as the
 * .tja), deduplicating by content hash so the same chart/audio pair
 * registered from multiple dani sets reuses a single physical copy.
 */
export function importSong(db: Database.Database, songsDir: string, tjaSourcePath: string): Song {
  const tjaBuf = readFileSync(tjaSourcePath)
  const parsed = parseTja(tjaBuf)
  const oggSourcePath = resolveOggPath(tjaSourcePath, parsed)
  const oggBuf = readFileSync(oggSourcePath)
  const contentHash = computeContentHash(tjaBuf, oggBuf)

  const existing = findSongByHash(db, contentHash)
  if (existing) return existing

  const id = randomUUID()
  const songDir = join(songsDir, id)
  mkdirSync(songDir, { recursive: true })
  copyFileSync(tjaSourcePath, join(songDir, 'chart.tja'))
  copyFileSync(oggSourcePath, join(songDir, 'audio.ogg'))

  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO songs
       (id, title, subtitle, content_hash, tja_stored_path, ogg_stored_path, tja_encoding, bpm, wave_filename_in_tja, created_at, updated_at)
     VALUES
       (@id, @title, @subtitle, @contentHash, @tjaStoredPath, @oggStoredPath, @tjaEncoding, @bpm, @wave, @createdAt, @updatedAt)`
  ).run({
    id,
    title: parsed.title ?? '(no title)',
    subtitle: parsed.subtitle ?? null,
    contentHash,
    tjaStoredPath: join('songs', id, 'chart.tja'),
    oggStoredPath: join('songs', id, 'audio.ogg'),
    tjaEncoding: parsed.encodingUsed,
    bpm: parsed.bpm ?? null,
    wave: parsed.wave ?? null,
    createdAt: now,
    updatedAt: now
  })

  const insertCourse = db.prepare(
    `INSERT INTO song_courses (song_id, course, level, note_count, balloon_counts, score_init, score_diff)
     VALUES (@songId, @course, @level, @noteCount, @balloonCounts, @scoreInit, @scoreDiff)`
  )
  for (const course of parsed.courses) {
    insertCourse.run({
      songId: id,
      course: course.course,
      level: course.level ?? null,
      noteCount: course.noteCount,
      balloonCounts: course.balloonCounts ? JSON.stringify(course.balloonCounts) : null,
      scoreInit: course.scoreInit ?? null,
      scoreDiff: course.scoreDiff ?? null
    })
  }

  return getSong(db, id) as Song
}

export function removeSong(
  db: Database.Database,
  songsDir: string,
  id: string,
  force = false
): RemoveSongResult {
  const usageCount = (
    db.prepare('SELECT COUNT(*) as count FROM song_slots WHERE song_id = ?').get(id) as {
      count: number
    }
  ).count

  if (usageCount > 0 && !force) {
    return { ok: false, blockedBySlots: usageCount }
  }

  db.prepare('DELETE FROM songs WHERE id = ?').run(id)
  const songDir = join(songsDir, id)
  if (existsSync(songDir)) {
    rmSync(songDir, { recursive: true, force: true })
  }
  return { ok: true, blockedBySlots: 0 }
}
