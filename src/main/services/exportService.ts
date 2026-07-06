import { createWriteStream } from 'fs'
import { copyFileSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type Database from 'better-sqlite3'
import yazl from 'yazl'
import type { DaniSet, Rank } from '../../shared/types/daniSet'
import { writeDaniDef } from './daniDefCodec'
import { folderNameForRank, fromInternalRank, writeDaniJson } from './daniJsonCodec'
import { loadSet } from './setService'
import { getSong } from './songLibraryService'

export interface ExportReport {
  ranksExported: number
}

interface PlannedFile {
  relativePath: string
  content?: Buffer
  absoluteSourcePath?: string
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim()
  return cleaned.length > 0 ? cleaned : 'untitled'
}

function validateSetIsExportable(set: DaniSet): void {
  const missing: string[] = []
  for (const rank of set.ranks) {
    rank.songSlots.forEach((slot, i) => {
      if (!slot.songId) {
        missing.push(`${rank.rankIndex},${rank.rankName} の${i + 1}曲目`)
      }
    })
  }
  if (missing.length > 0) {
    throw new Error(`曲が割り当てられていない項目があります: ${missing.join(' / ')}`)
  }
}

function buildExportPlan(db: Database.Database, userDataDir: string, set: DaniSet): PlannedFile[] {
  const files: PlannedFile[] = [
    { relativePath: 'dani.def', content: writeDaniDef({ title: set.title, index: set.index }) }
  ]

  for (const rank of set.ranks) {
    const rankFolder = folderNameForRank(rank)
    const tjaPaths: string[] = []

    for (const slot of rank.songSlots) {
      const song = getSong(db, slot.songId as string)
      if (!song) {
        throw new Error(`曲データが見つかりません(songId=${slot.songId})`)
      }
      const baseName = sanitizeFilename(song.title)
      const tjaName = `${baseName}.tja`
      const oggName = `${baseName}.ogg`

      files.push({
        relativePath: `${rankFolder}/fumen/${tjaName}`,
        absoluteSourcePath: join(userDataDir, song.tjaStoredPath)
      })
      files.push({
        relativePath: `${rankFolder}/fumen/${oggName}`,
        absoluteSourcePath: join(userDataDir, song.oggStoredPath)
      })
      tjaPaths.push(`fumen\\${tjaName}`)
    }

    const raw = fromInternalRank(rank as Rank, tjaPaths)
    files.push({ relativePath: `${rankFolder}/dani.json`, content: writeDaniJson(raw) })
  }

  return files
}

export function exportSetToFolder(
  db: Database.Database,
  userDataDir: string,
  setId: string,
  destDir: string
): ExportReport {
  const set = loadSet(db, setId)
  if (!set) throw new Error('指定されたセットが見つかりません')
  validateSetIsExportable(set)

  const plan = buildExportPlan(db, userDataDir, set)
  const setRoot = join(destDir, sanitizeFilename(set.title))

  for (const file of plan) {
    const targetPath = join(setRoot, ...file.relativePath.split('/'))
    mkdirSync(dirname(targetPath), { recursive: true })
    if (file.content) {
      writeFileSync(targetPath, file.content)
    } else {
      copyFileSync(file.absoluteSourcePath as string, targetPath)
    }
  }

  return { ranksExported: set.ranks.length }
}

export function exportSetToZip(
  db: Database.Database,
  userDataDir: string,
  setId: string,
  destZipPath: string
): Promise<ExportReport> {
  const set = loadSet(db, setId)
  if (!set) throw new Error('指定されたセットが見つかりません')
  validateSetIsExportable(set)

  const plan = buildExportPlan(db, userDataDir, set)
  const setRootName = sanitizeFilename(set.title)

  return new Promise((resolve, reject) => {
    const zipfile = new yazl.ZipFile()

    for (const file of plan) {
      const entryPath = `${setRootName}/${file.relativePath}`
      if (file.content) {
        zipfile.addBuffer(file.content, entryPath)
      } else {
        zipfile.addFile(file.absoluteSourcePath as string, entryPath)
      }
    }

    const output = createWriteStream(destZipPath)
    output.on('close', () => resolve({ ranksExported: set.ranks.length }))
    output.on('error', reject)
    zipfile.outputStream.pipe(output)
    zipfile.end()
  })
}
