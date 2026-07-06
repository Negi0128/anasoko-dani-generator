import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type Database from 'better-sqlite3'
import type { Rank } from '../../shared/types/daniSet'
import type { ImportReport } from '../../shared/types/importReport'
import { readDaniDef } from './daniDefCodec'
import { parseRankFolderName, readDaniJson, toInternalRank } from './daniJsonCodec'
import { createSet, saveSet } from './setService'
import { importSong, listSongs } from './songLibraryService'
import { extractZipToFolder } from './zipCodec'

const RANK_FOLDER_PATTERN = /^\d+,.+$/

/** dani.def may live at the root of the given folder, or one level down
 * inside a single wrapper folder (as produced by zip archives that bundle
 * everything under one top-level directory). */
function findSetRoot(extractedRoot: string): string {
  if (existsSync(join(extractedRoot, 'dani.def'))) {
    return extractedRoot
  }
  const entries = readdirSync(extractedRoot, { withFileTypes: true }).filter((e) => e.isDirectory())
  for (const entry of entries) {
    const candidate = join(extractedRoot, entry.name)
    if (existsSync(join(candidate, 'dani.def'))) {
      return candidate
    }
  }
  throw new Error('dani.def が見つかりませんでした(段位道場セットのフォルダ構造ではありません)')
}

export function importSetFromFolder(
  db: Database.Database,
  songsDir: string,
  sourceRootDir: string
): ImportReport {
  const setRoot = findSetRoot(sourceRootDir)
  const def = readDaniDef(readFileSync(join(setRoot, 'dani.def')))
  const created = createSet(db, { title: def.title, index: def.index })

  const rankFolders = readdirSync(setRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && RANK_FOLDER_PATTERN.test(e.name))
    .sort((a, b) => parseRankFolderName(a.name).rankIndex - parseRankFolderName(b.name).rankIndex)

  const warnings: string[] = []
  let songsAdded = 0
  let songsDeduped = 0
  const ranks: Rank[] = []

  for (const folder of rankFolders) {
    const rankDir = join(setRoot, folder.name)
    const daniJsonPath = join(rankDir, 'dani.json')
    if (!existsSync(daniJsonPath)) {
      warnings.push(`${folder.name}: dani.json が見つからないためスキップしました`)
      continue
    }

    const raw = readDaniJson(readFileSync(daniJsonPath))
    const rank = toInternalRank(raw, folder.name)

    const songIds = raw.tja_Path.map((relTjaPath) => {
      const tjaAbsPath = join(rankDir, relTjaPath)
      if (!existsSync(tjaAbsPath)) {
        warnings.push(`${folder.name}: 譜面ファイルが見つかりません (${relTjaPath})`)
        return null
      }
      const beforeCount = listSongs(db).length
      try {
        const song = importSong(db, songsDir, tjaAbsPath)
        const afterCount = listSongs(db).length
        if (afterCount > beforeCount) songsAdded++
        else songsDeduped++
        return song.id
      } catch (e) {
        warnings.push(
          `${folder.name}: 曲の取り込みに失敗しました (${relTjaPath}) - ${
            e instanceof Error ? e.message : String(e)
          }`
        )
        return null
      }
    })

    ranks.push({
      ...rank,
      songSlots: rank.songSlots.map((slot, i) => ({ ...slot, songId: songIds[i] ?? null }))
    })
  }

  saveSet(db, { ...created, ranks })

  return {
    setId: created.id,
    ranksImported: ranks.length,
    songsAdded,
    songsDeduped,
    warnings
  }
}

export async function importSetFromZip(
  db: Database.Database,
  songsDir: string,
  zipPath: string
): Promise<ImportReport> {
  const tempDir = mkdtempSync(join(tmpdir(), 'anasoko-import-'))
  try {
    const { warnings: extractWarnings } = await extractZipToFolder(zipPath, tempDir)
    const report = importSetFromFolder(db, songsDir, tempDir)
    return { ...report, warnings: [...extractWarnings, ...report.warnings] }
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}
