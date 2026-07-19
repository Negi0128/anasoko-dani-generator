import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import yauzl from 'yauzl'
import { openDatabase } from './db'
import { createSet, saveSet } from './setService'
import { createPack } from './packService'
import { decrypt } from './packCrypto'
import type { DaniSet } from '../../shared/types/daniSet'
import type { PackManifestV3 } from '../../shared/types/pack'

function readZipEntryNames(zipPath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err)
      const names: string[] = []
      zipfile.on('entry', (entry) => {
        names.push(entry.fileName)
        zipfile.readEntry()
      })
      zipfile.on('end', () => resolve(names))
      zipfile.on('error', reject)
      zipfile.readEntry()
    })
  })
}

function readZipEntryBuffer(zipPath: string, entryName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err)
      zipfile.on('entry', (entry) => {
        if (entry.fileName !== entryName) {
          zipfile.readEntry()
          return
        }
        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) return reject(streamErr)
          const chunks: Buffer[] = []
          readStream.on('data', (c: Buffer) => chunks.push(c))
          readStream.on('end', () => resolve(Buffer.concat(chunks)))
          readStream.on('error', reject)
        })
      })
      zipfile.on('end', () => reject(new Error(`entry not found: ${entryName}`)))
      zipfile.on('error', reject)
      zipfile.readEntry()
    })
  })
}

function readZipEntryNamesFromBuffer(buf: Buffer): Promise<string[]> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buf, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err)
      const names: string[] = []
      zipfile.on('entry', (entry) => {
        names.push(entry.fileName)
        zipfile.readEntry()
      })
      zipfile.on('end', () => resolve(names))
      zipfile.on('error', reject)
      zipfile.readEntry()
    })
  })
}

describe('packService', () => {
  let db: Database.Database
  let userDataDir: string
  let workDir: string

  function seedSong(id: string, title: string): void {
    const songDir = join(userDataDir, 'songs', id)
    mkdirSync(songDir, { recursive: true })
    writeFileSync(join(songDir, 'chart.tja'), `TITLE:${title}\r\nBPM:150\r\n`)
    writeFileSync(join(songDir, 'audio.ogg'), Buffer.from([0x01, 0x02]))
  }

  function songSlot(id: string, songId: string, title: string, diff: number): DaniSet['ranks'][0]['songSlots'][0] {
    return {
      id,
      tjaRelPath: `songs/${songId}/chart.tja`,
      oggRelPath: `songs/${songId}/audio.ogg`,
      songTitle: title,
      courses: [],
      diff,
      songGenreLabel: '',
      hidden: false,
      analysisBranch: null
    }
  }

  function buildTestSet(setId: string): DaniSet {
    return {
      id: setId,
      title: 'テストパックセット',
      index: 0,
      lastExportPath: null,
      ranks: [
        {
          id: 'rank-0',
          rankIndex: 14,
          rankName: '十段',
          title: '',
          gauge: { red: 98, gold: 100 },
          statKinds: [{ label: 'HitCount', continuous: true, cumulativeBorder: { red: 100, gold: 120 } }],
          songSlots: [songSlot('slot-0', 'song-a', '曲A', 3)]
        },
        {
          id: 'rank-1',
          rankIndex: 18,
          rankName: '達人',
          title: '達人道場',
          gauge: { red: 98, gold: 100 },
          statKinds: [{ label: 'HitCount', continuous: true, cumulativeBorder: { red: 100, gold: 120 } }],
          songSlots: [songSlot('slot-1', 'song-b', '曲B', 4)]
        }
      ]
    }
  }

  function makeRewardFolder(name: string, fileCount: number): string {
    const dir = join(workDir, 'rewards', name)
    mkdirSync(dir, { recursive: true })
    for (let i = 0; i < fileCount; i++) {
      writeFileSync(join(dir, `file${i}.dat`), Buffer.from([i]))
    }
    return dir
  }

  beforeEach(() => {
    db = openDatabase(':memory:')
    userDataDir = mkdtempSync(join(tmpdir(), 'anasoko-pack-userdata-'))
    workDir = mkdtempSync(join(tmpdir(), 'anasoko-pack-work-'))
    seedSong('song-a', '曲A')
    seedSong('song-b', '曲B')
  })

  afterEach(() => {
    db.close()
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(workDir, { recursive: true, force: true })
  })

  it('creates a pack whose self-test passes and whose dan.zip has the set at the root', async () => {
    const created = createSet(db, { title: 'テストパックセット', index: 0 })
    saveSet(db, buildTestSet(created.id))

    const rewardA = makeRewardFolder('新曲A', 2)
    const rewardB = makeRewardFolder('新曲B', 3)

    const destPath = join(workDir, 'output.anskpack')

    const result = await createPack(
      { db, userDataDir },
      {
        setId: created.id,
        name: '十段〜達人チャレンジ',
        author: 'Negi',
        destPath,
        rules: [
          {
            targetRankFolder: '14,十段',
            condition: 'pass',
            message: '十段合格おめでとう！',
            rewardSourceFolders: [rewardA]
          },
          {
            targetRankFolder: '18,達人',
            condition: 'fullcombo',
            message: '達人フルコンボおめでとう！',
            rewardSourceFolders: [rewardB]
          }
        ]
      }
    )

    expect(result.selfTest.manifestOk).toBe(true)
    expect(result.selfTest.ok).toBe(true)
    expect(result.selfTest.rules).toHaveLength(2)
    for (const ruleResult of result.selfTest.rules) {
      expect(ruleResult.ok).toBe(true)
    }
    const totalsByExpected = result.selfTest.rules.map((r) => r.expectedFileCount).sort()
    expect(totalsByExpected).toEqual([2, 3])

    const outerEntryNames = await readZipEntryNames(destPath)
    expect(outerEntryNames).toContain('manifest.json')
    expect(outerEntryNames).toContain('dan.zip')
    expect(outerEntryNames.some((n) => /^reward_.+\.enc$/.test(n))).toBe(true)
    expect(outerEntryNames.filter((n) => /^reward_.+\.enc$/.test(n))).toHaveLength(2)

    const manifestBuf = await readZipEntryBuffer(destPath, 'manifest.json')
    const manifest = JSON.parse(manifestBuf.toString('utf-8')) as PackManifestV3
    expect(manifest.format_version).toBe(3)
    expect(manifest.set_folder).toBe('テストパックセット')
    expect(manifest.rules).toHaveLength(2)

    const ruleForJudan = manifest.rules.find((r) => r.target_rank_folder === '14,十段')
    expect(ruleForJudan?.target_dan_display).toBe('十段') // empty title -> falls back to folder name after ","
    expect(ruleForJudan?.reward_songs).toEqual(['新曲A'])

    const ruleForTatsujin = manifest.rules.find((r) => r.target_rank_folder === '18,達人')
    expect(ruleForTatsujin?.target_dan_display).toBe('達人道場') // uses dani.json title

    // dan.zip should have the set's contents at the root, not nested under a
    // set-title folder like exportSetToZip produces.
    const danZipBuf = await readZipEntryBuffer(destPath, 'dan.zip')
    const danZipEntries = await readZipEntryNamesFromBuffer(danZipBuf)
    expect(danZipEntries).toContain('dani.def')
    expect(danZipEntries).toContain('14,十段/dani.json')
    expect(danZipEntries).toContain('14,十段/fumen/曲A.tja')
    expect(danZipEntries).toContain('18,達人/dani.json')

    // Rewards are individually decryptable and unreadable without the
    // matching rule_id.
    const rewardEntryName = outerEntryNames.find((n) => n.startsWith(`reward_${ruleForJudan?.rule_id}`))
    expect(rewardEntryName).toBeDefined()
    const rewardEncBuf = await readZipEntryBuffer(destPath, rewardEntryName as string)
    const decrypted = decrypt(rewardEncBuf, ruleForJudan?.rule_id as string)
    const rewardEntries = await readZipEntryNamesFromBuffer(decrypted)
    expect(rewardEntries).toEqual(expect.arrayContaining(['新曲A/file0.dat', '新曲A/file1.dat']))

    expect(() => decrypt(rewardEncBuf, ruleForTatsujin?.rule_id as string)).toThrow()
  })

  it('throws when the target rank folder does not exist in the set', async () => {
    const created = createSet(db, { title: 'テストパックセット', index: 0 })
    saveSet(db, buildTestSet(created.id))
    const rewardA = makeRewardFolder('新曲A', 1)

    await expect(
      createPack(
        { db, userDataDir },
        {
          setId: created.id,
          name: 'テスト',
          author: 'Negi',
          destPath: join(workDir, 'bad.anskpack'),
          rules: [
            {
              targetRankFolder: '99,存在しない',
              condition: 'pass',
              message: '',
              rewardSourceFolders: [rewardA]
            }
          ]
        }
      )
    ).rejects.toThrow('対象段位が見つかりません')
  })

  it('throws when there are no rules', async () => {
    const created = createSet(db, { title: 'テストパックセット', index: 0 })
    saveSet(db, buildTestSet(created.id))

    await expect(
      createPack(
        { db, userDataDir },
        {
          setId: created.id,
          name: 'テスト',
          author: 'Negi',
          destPath: join(workDir, 'empty.anskpack'),
          rules: []
        }
      )
    ).rejects.toThrow('ルールを1つ以上指定してください')
  })
})
