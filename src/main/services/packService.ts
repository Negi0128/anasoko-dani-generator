import { randomUUID } from 'crypto'
import { createWriteStream, readdirSync } from 'fs'
import { basename, join } from 'path'
import type Database from 'better-sqlite3'
import yauzl from 'yauzl'
import yazl from 'yazl'
import type {
  CreatePackParamsInput,
  CreatePackResult,
  PackManifestRuleV3,
  PackManifestV3,
  PackSelfTestResult,
  PackSelfTestRuleResult
} from '../../shared/types/pack'
import { decrypt, encrypt } from './packCrypto'
import { assertSetIsExportable, buildExportPlan, sanitizeFilename } from './exportService'
import { folderNameForRank, parseRankFolderName } from './daniJsonCodec'
import { loadSet } from './setService'

/** Drains a yazl ZipFile's output stream into memory instead of a file on disk. */
function collectZipToBuffer(zipfile: yazl.ZipFile): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    zipfile.outputStream.on('data', (chunk: Buffer) => chunks.push(chunk))
    zipfile.outputStream.on('end', () => resolve(Buffer.concat(chunks)))
    zipfile.outputStream.on('error', reject)
    zipfile.end()
  })
}

function writeZipToFile(zipfile: yazl.ZipFile, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(destPath)
    output.on('close', () => resolve())
    output.on('error', reject)
    zipfile.outputStream.pipe(output)
    zipfile.end()
  })
}

function addFolderToZip(zipfile: yazl.ZipFile, absDir: string, entryPrefix: string): void {
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const absPath = join(absDir, entry.name)
    const entryPath = `${entryPrefix}/${entry.name}`
    if (entry.isDirectory()) {
      addFolderToZip(zipfile, absPath, entryPath)
    } else if (entry.isFile()) {
      zipfile.addFile(absPath, entryPath)
    }
  }
}

function countFilesRecursive(absDir: string): number {
  let count = 0
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const absPath = join(absDir, entry.name)
    if (entry.isDirectory()) {
      count += countFilesRecursive(absPath)
    } else if (entry.isFile()) {
      count++
    }
  }
  return count
}

/**
 * Builds the plain "dan.zip" entry: the whole dani set (dani.def +
 * <N,名前>/dani.json + fumen/*) with the set's contents at the zip root
 * (unlike exportSetToZip, which nests everything under a set-title folder).
 * Reuses buildExportPlan so this stays in lockstep with normal folder/zip
 * export.
 */
export async function buildDanZip(
  db: Database.Database,
  userDataDir: string,
  setId: string
): Promise<Buffer> {
  const set = loadSet(db, setId)
  if (!set) throw new Error('指定されたセットが見つかりません')
  assertSetIsExportable(set)

  const plan = buildExportPlan(userDataDir, set)
  const zipfile = new yazl.ZipFile()
  for (const file of plan) {
    if (file.content) {
      zipfile.addBuffer(file.content, file.relativePath)
    } else {
      zipfile.addFile(file.absoluteSourcePath as string, file.relativePath)
    }
  }
  return collectZipToBuffer(zipfile)
}

/**
 * Builds one rule's encrypted reward payload: the given song folders zipped
 * with the folder name at the zip root (no genre/category prefix — the
 * player chooses the placement folder on import), then AES-256-CBC
 * encrypted with a key derived from ruleId.
 */
export async function buildRewardEnc(rewardSourceFolders: string[], ruleId: string): Promise<Buffer> {
  const zipfile = new yazl.ZipFile()
  for (const folder of rewardSourceFolders) {
    addFolderToZip(zipfile, folder, basename(folder))
  }
  const innerZip = await collectZipToBuffer(zipfile)
  return encrypt(innerZip, ruleId)
}

/** Writes the outer .anskpack container: manifest.json + dan.zip + reward_<ruleId>.enc per rule. */
export async function writePack(
  destPath: string,
  manifest: PackManifestV3,
  danZip: Buffer,
  rewardEncByRuleId: Record<string, Buffer>
): Promise<void> {
  const zipfile = new yazl.ZipFile()
  zipfile.addBuffer(Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8'), 'manifest.json')
  zipfile.addBuffer(danZip, 'dan.zip')
  for (const [ruleId, buf] of Object.entries(rewardEncByRuleId)) {
    zipfile.addBuffer(buf, `reward_${ruleId}.enc`)
  }
  await writeZipToFile(zipfile, destPath)
}

function readZipEntriesToBuffers(zipPath: string): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error('zipファイルを開けませんでした'))
        return
      }
      const result = new Map<string, Buffer>()
      zipfile.on('entry', (entry) => {
        if (entry.fileName.endsWith('/')) {
          zipfile.readEntry()
          return
        }
        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) {
            reject(streamErr ?? new Error(`読み込みに失敗しました: ${entry.fileName}`))
            return
          }
          const chunks: Buffer[] = []
          readStream.on('data', (chunk: Buffer) => chunks.push(chunk))
          readStream.on('end', () => {
            result.set(entry.fileName, Buffer.concat(chunks))
            zipfile.readEntry()
          })
          readStream.on('error', reject)
        })
      })
      zipfile.on('end', () => resolve(result))
      zipfile.on('error', reject)
      zipfile.readEntry()
    })
  })
}

function countZipFileEntries(buf: Buffer): Promise<number> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buf, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error('reward zipを開けませんでした'))
        return
      }
      let count = 0
      zipfile.on('entry', (entry) => {
        if (!entry.fileName.endsWith('/')) count++
        zipfile.readEntry()
      })
      zipfile.on('end', () => resolve(count))
      zipfile.on('error', reject)
      zipfile.readEntry()
    })
  })
}

/**
 * Reads the just-written .anskpack back, decrypts each reward payload with
 * the key derived from its rule_id, and checks the decrypted zip's file
 * count against what was actually zipped. Mirrors the C# Pack Maker's
 * self-test.
 */
async function runSelfTest(
  packPath: string,
  expectedFileCountByRuleId: Record<string, number>
): Promise<PackSelfTestResult> {
  const entries = await readZipEntriesToBuffers(packPath)
  const manifestBuf = entries.get('manifest.json')
  if (!manifestBuf) throw new Error('selfTest: manifest.json が見つかりません')

  const manifest = JSON.parse(manifestBuf.toString('utf-8')) as PackManifestV3
  const manifestOk =
    manifest.format_version === 3 &&
    typeof manifest.pack_id === 'string' &&
    manifest.pack_id.length > 0 &&
    Array.isArray(manifest.rules)

  const ruleResults: PackSelfTestRuleResult[] = []
  for (const rule of manifest.rules) {
    const encBuf = entries.get(`reward_${rule.rule_id}.enc`)
    const expectedFileCount = expectedFileCountByRuleId[rule.rule_id] ?? 0
    if (!encBuf) {
      ruleResults.push({ ruleId: rule.rule_id, expectedFileCount, actualFileCount: -1, ok: false })
      continue
    }
    const decrypted = decrypt(encBuf, rule.rule_id)
    const actualFileCount = await countZipFileEntries(decrypted)
    ruleResults.push({
      ruleId: rule.rule_id,
      expectedFileCount,
      actualFileCount,
      ok: actualFileCount === expectedFileCount
    })
  }

  const ok = manifestOk && entries.has('dan.zip') && ruleResults.every((r) => r.ok)
  return { manifestOk, rules: ruleResults, ok }
}

function targetDanDisplayFor(
  set: ReturnType<typeof loadSet>,
  targetRankFolder: string
): string {
  const rank = set?.ranks.find((r) => folderNameForRank(r) === targetRankFolder)
  if (!rank) {
    throw new Error(`対象段位が見つかりません: ${targetRankFolder}`)
  }
  if (rank.title && rank.title.trim().length > 0) {
    return rank.title
  }
  return parseRankFolderName(targetRankFolder).rankName
}

export interface CreatePackDeps {
  db: Database.Database
  userDataDir: string
}

/**
 * Assembles and writes a full .anskpack v3: the set's dan.zip, one encrypted
 * reward payload per rule, and the manifest tying them together — then runs
 * a self-test on the freshly written file.
 */
export async function createPack(
  deps: CreatePackDeps,
  params: CreatePackParamsInput
): Promise<CreatePackResult> {
  const set = loadSet(deps.db, params.setId)
  if (!set) throw new Error('指定されたセットが見つかりません')
  if (params.rules.length === 0) throw new Error('ルールを1つ以上指定してください')

  const danZip = await buildDanZip(deps.db, deps.userDataDir, params.setId)

  const rules: PackManifestRuleV3[] = []
  const rewardEncByRuleId: Record<string, Buffer> = {}
  const expectedFileCountByRuleId: Record<string, number> = {}

  for (const ruleInput of params.rules) {
    const ruleId = randomUUID()
    const targetDanDisplay = targetDanDisplayFor(set, ruleInput.targetRankFolder)

    const rewardEnc = await buildRewardEnc(ruleInput.rewardSourceFolders, ruleId)
    rewardEncByRuleId[ruleId] = rewardEnc
    expectedFileCountByRuleId[ruleId] = ruleInput.rewardSourceFolders.reduce(
      (sum, folder) => sum + countFilesRecursive(folder),
      0
    )

    rules.push({
      rule_id: ruleId,
      target_rank_folder: ruleInput.targetRankFolder,
      target_dan_display: targetDanDisplay,
      condition: ruleInput.condition,
      message: ruleInput.message,
      reward_songs: ruleInput.rewardSourceFolders.map((f) => basename(f))
    })
  }

  const setFolder = sanitizeFilename(set.title)
  if (setFolder.length === 0) {
    throw new Error('セット名からフォルダ名を作れません。セット名を変更してください')
  }

  const manifest: PackManifestV3 = {
    format_version: 3,
    name: params.name,
    author: params.author,
    pack_id: randomUUID(),
    set_folder: setFolder,
    rules
  }

  await writePack(params.destPath, manifest, danZip, rewardEncByRuleId)

  const selfTest = await runSelfTest(params.destPath, expectedFileCountByRuleId)
  return { selfTest }
}
