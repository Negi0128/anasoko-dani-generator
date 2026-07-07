import { randomUUID } from 'crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import type { SongAssetResult } from '../../shared/types/song'
import type { SongCourse } from '../../shared/types/song'
import { parseTja, TjaParseResult } from './tjaParser'
import { analyzeTjaRolls } from './tjaRollAnalyzer'

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

/** Combines the header/note-count parse with the roll/balloon-hit analysis
 * into the SongCourse shape a SongSlot stores. */
function buildCourses(tjaBuf: Buffer): SongCourse[] {
  const parsed = parseTja(tjaBuf)
  const rollAnalyses = analyzeTjaRolls(tjaBuf)

  return parsed.courses.map((course) => {
    const rollAnalysis = rollAnalyses.find((a) => a.course === course.course)
    return {
      course: course.course,
      level: course.level ?? null,
      noteCount: course.noteCount,
      balloonCounts: course.balloonCounts ?? null,
      scoreInit: course.scoreInit ?? null,
      scoreDiff: course.scoreDiff ?? null,
      hasBranches: rollAnalysis?.hasBranches ?? false,
      defaultBranch: rollAnalysis?.defaultBranch ?? 'N',
      branches: rollAnalysis?.branches ?? {}
    }
  })
}

/**
 * Copies a picked .tja (and its resolved .ogg) into local storage under its
 * own fresh folder and returns the metadata a SongSlot needs. There is no
 * shared library or dedup: every assignment gets its own physical copy.
 */
export function assignSongFile(songsDir: string, tjaSourcePath: string): SongAssetResult {
  const tjaBuf = readFileSync(tjaSourcePath)
  const parsed = parseTja(tjaBuf)
  const oggSourcePath = resolveOggPath(tjaSourcePath, parsed)

  const id = randomUUID()
  const songDir = join(songsDir, id)
  mkdirSync(songDir, { recursive: true })
  copyFileSync(tjaSourcePath, join(songDir, 'chart.tja'))
  copyFileSync(oggSourcePath, join(songDir, 'audio.ogg'))

  return {
    tjaRelPath: join('songs', id, 'chart.tja'),
    oggRelPath: join('songs', id, 'audio.ogg'),
    songTitle: parsed.title ?? '(no title)',
    courses: buildCourses(tjaBuf)
  }
}

/** Re-runs analysis against an already-copied song file, so slots assigned
 * before a given metric existed (or before a parsing fix) can self-heal
 * without having to re-pick the file. */
export function analyzeExistingSong(userDataDir: string, tjaRelPath: string): SongCourse[] {
  const tjaBuf = readFileSync(join(userDataDir, tjaRelPath))
  return buildCourses(tjaBuf)
}
