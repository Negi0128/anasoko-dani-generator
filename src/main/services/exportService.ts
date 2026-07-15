import { createWriteStream, existsSync, readdirSync, readFileSync, rmSync } from 'fs'
import { copyFileSync, mkdirSync, writeFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import type Database from 'better-sqlite3'
import yazl from 'yazl'
import type { DaniSet, Rank } from '../../shared/types/daniSet'
import type { ExportedRankSummary, ExportFolderConflict } from '../../shared/types/exportConflict'
import type { ExportReport } from '../../shared/types/exportReport'
import type { ValidationReport } from '../../shared/types/validationReport'
import { writeDaniDef } from './daniDefCodec'
import {
  folderNameForRank,
  fromInternalRank,
  readDaniJson,
  toInternalRank,
  writeDaniJson
} from './daniJsonCodec'
import { loadSet, setLastExportPath } from './setService'

export type { ExportReport } from '../../shared/types/exportReport'

interface PlannedFile {
  relativePath: string
  content?: Buffer
  absoluteSourcePath?: string
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim()
  return cleaned.length > 0 ? cleaned : 'untitled'
}

/** Finds the smallest unused positive folder number (e.g. "001-", "002-")
 * directly under the Dani root, so repeated exports don't collide. */
function nextAvailableSetNumber(daniRootDir: string): number {
  let entries: string[] = []
  try {
    entries = readdirSync(daniRootDir)
  } catch {
    return 1
  }
  const used = new Set<number>()
  for (const name of entries) {
    const match = /^(\d+)-/.exec(name)
    if (match) used.add(Number(match[1]))
  }
  let n = 1
  while (used.has(n)) n++
  return n
}

function numberedSetFolderName(daniRootDir: string, title: string): string {
  const number = nextAvailableSetNumber(daniRootDir)
  return `${String(number).padStart(3, '0')}-${sanitizeFilename(title)}`
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Finds a folder already exported for this exact title (e.g. "003-十段"),
 * so re-exporting the same set doesn't just pile up numbered duplicates. */
function findExistingSetFolderName(daniRootDir: string, title: string): string | null {
  let entries: string[] = []
  try {
    entries = readdirSync(daniRootDir)
  } catch {
    return null
  }
  const pattern = new RegExp(`^\\d+-${escapeRegExp(sanitizeFilename(title))}$`)
  return entries.find((name) => pattern.test(name)) ?? null
}

function summarizeRank(rank: Rank): ExportedRankSummary {
  return {
    rankIndex: rank.rankIndex,
    rankName: rank.rankName,
    title: rank.title,
    songTitles: rank.songSlots.map((s) => s.songTitle ?? '(未選択)'),
    gauge: rank.gauge,
    statKindLabels: rank.statKinds.map((s) => s.label)
  }
}

/** Reconstructs a comparable summary from an already-exported folder's
 * dani.json files, without touching the DB (mirrors importService's folder
 * walk but stops short of actually importing songs). */
function summarizeExportedFolder(setRoot: string): ExportedRankSummary[] {
  let entries: { name: string; isDirectory(): boolean }[] = []
  try {
    entries = readdirSync(setRoot, { withFileTypes: true })
  } catch {
    return []
  }
  const summaries: ExportedRankSummary[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\d+,.+$/.test(entry.name)) continue
    const daniJsonPath = join(setRoot, entry.name, 'dani.json')
    if (!existsSync(daniJsonPath)) continue
    const raw = readDaniJson(readFileSync(daniJsonPath))
    const rank = toInternalRank(raw, entry.name)
    summaries.push({
      rankIndex: rank.rankIndex,
      rankName: rank.rankName,
      title: rank.title,
      songTitles: raw.tja_Path.map((p) => basename(p, '.tja')),
      gauge: rank.gauge,
      statKindLabels: rank.statKinds.map((s) => s.label)
    })
  }
  return summaries.sort((a, b) => a.rankIndex - b.rankIndex)
}

/** The folder this set already owns under destDir, if any: the one it was last
 * exported to. Only counts when it still exists and still sits directly under
 * destDir, so changing the Dani folder setting starts a fresh export there. */
function ownedExportFolderName(set: DaniSet, destDir: string): string | null {
  if (!set.lastExportPath) return null
  if (dirname(set.lastExportPath) !== destDir) return null
  if (!existsSync(set.lastExportPath)) return null
  return basename(set.lastExportPath)
}

export function checkExportFolderConflict(
  db: Database.Database,
  setId: string,
  destDir: string
): ExportFolderConflict | null {
  const set = loadSet(db, setId)
  if (!set) throw new Error('指定されたセットが見つかりません')
  // A folder this set exported itself is not a conflict — it gets overwritten
  // silently so the play -> add rank -> re-export loop stays friction-free.
  if (ownedExportFolderName(set, destDir)) return null
  const existingFolderName = findExistingSetFolderName(destDir, set.title)
  if (!existingFolderName) return null
  return {
    folderName: existingFolderName,
    before: summarizeExportedFolder(join(destDir, existingFolderName)),
    after: set.ranks.map(summarizeRank)
  }
}

export function validateSet(set: DaniSet): ValidationReport {
  const issues: ValidationReport['issues'] = []
  for (const rank of set.ranks) {
    rank.songSlots.forEach((slot, i) => {
      if (!slot.tjaRelPath || !slot.oggRelPath) {
        issues.push({
          rankIndex: rank.rankIndex,
          rankName: rank.rankName,
          slotIndex: i,
          reason: '曲が割り当てられていない'
        })
      }
    })
  }
  return { isValid: issues.length === 0, issues }
}

function assertSetIsExportable(set: DaniSet): void {
  const report = validateSet(set)
  if (!report.isValid) {
    const missing = report.issues.map((i) => `${i.rankIndex},${i.rankName} の${i.slotIndex + 1}曲目`)
    throw new Error(`曲が割り当てられていない項目があります: ${missing.join(' / ')}`)
  }
}

function buildExportPlan(userDataDir: string, set: DaniSet): PlannedFile[] {
  const files: PlannedFile[] = [
    { relativePath: 'dani.def', content: writeDaniDef({ title: set.title, index: set.index }) }
  ]

  for (const rank of set.ranks) {
    const rankFolder = folderNameForRank(rank)
    const tjaPaths: string[] = []

    for (const slot of rank.songSlots) {
      const baseName = sanitizeFilename(slot.songTitle ?? '')
      const tjaName = `${baseName}.tja`
      const oggName = `${baseName}.ogg`

      files.push({
        relativePath: `${rankFolder}/fumen/${tjaName}`,
        absoluteSourcePath: join(userDataDir, slot.tjaRelPath as string)
      })
      files.push({
        relativePath: `${rankFolder}/fumen/${oggName}`,
        absoluteSourcePath: join(userDataDir, slot.oggRelPath as string)
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
  destDir: string,
  overwriteFolderName?: string
): ExportReport {
  const set = loadSet(db, setId)
  if (!set) throw new Error('指定されたセットが見つかりません')
  assertSetIsExportable(set)

  const plan = buildExportPlan(userDataDir, set)
  // Priority: an explicit overwrite the user confirmed > the folder this set
  // already owns here (silent overwrite) > a fresh numbered folder.
  const reusedFolderName = overwriteFolderName ?? ownedExportFolderName(set, destDir)
  const folderName = reusedFolderName ?? numberedSetFolderName(destDir, set.title)
  const setRoot = join(destDir, folderName)

  if (reusedFolderName) {
    rmSync(setRoot, { recursive: true, force: true })
  }

  for (const file of plan) {
    const targetPath = join(setRoot, ...file.relativePath.split('/'))
    mkdirSync(dirname(targetPath), { recursive: true })
    if (file.content) {
      writeFileSync(targetPath, file.content)
    } else {
      copyFileSync(file.absoluteSourcePath as string, targetPath)
    }
  }

  setLastExportPath(db, setId, setRoot)
  return { ranksExported: set.ranks.length, folderPath: setRoot }
}

export function exportSetToZip(
  db: Database.Database,
  userDataDir: string,
  setId: string,
  destZipPath: string
): Promise<ExportReport> {
  const set = loadSet(db, setId)
  if (!set) throw new Error('指定されたセットが見つかりません')
  assertSetIsExportable(set)

  const plan = buildExportPlan(userDataDir, set)
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
