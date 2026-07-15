import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from './db'
import { createSet, loadSet, saveSet } from './setService'
import { readDaniDef } from './daniDefCodec'
import { readDaniJson } from './daniJsonCodec'
import {
  checkExportFolderConflict,
  exportSetToFolder,
  exportSetToZip,
  validateSet
} from './exportService'
import type { DaniSet } from '../../shared/types/daniSet'

describe('exportService', () => {
  let db: Database.Database
  let userDataDir: string
  let destDir: string

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

  // Ids are namespaced by setId so two sets can coexist in the same DB.
  function buildTestSet(setId: string, title = 'テストセット'): DaniSet {
    return {
      id: setId,
      title,
      index: 0,
      lastExportPath: null,
      ranks: [
        {
          id: `${setId}-rank-0`,
          rankIndex: 0,
          rankName: '五級',
          title: '五級',
          gauge: { red: 98, gold: 100 },
          statKinds: [{ label: 'HitCount', continuous: true, cumulativeBorder: { red: 100, gold: 120 } }],
          songSlots: [
            songSlot(`${setId}-slot-0`, 'song-a', '曲A', 3),
            songSlot(`${setId}-slot-1`, 'song-b', '曲B', 3),
            songSlot(`${setId}-slot-2`, 'song-c', '曲C', 2)
          ]
        }
      ]
    }
  }

  beforeEach(() => {
    db = openDatabase(':memory:')
    userDataDir = mkdtempSync(join(tmpdir(), 'anasoko-export-userdata-'))
    destDir = mkdtempSync(join(tmpdir(), 'anasoko-export-dest-'))
    seedSong('song-a', '曲A')
    seedSong('song-b', '曲B')
    seedSong('song-c', '曲C')
  })

  afterEach(() => {
    db.close()
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(destDir, { recursive: true, force: true })
  })

  it('refuses to export a set with an unassigned song slot', () => {
    const created = createSet(db, { title: 'Incomplete', index: 0 })
    saveSet(db, {
      ...buildTestSet(created.id),
      ranks: [
        {
          ...buildTestSet(created.id).ranks[0],
          songSlots: [
            {
              id: 'slot-0',
              tjaRelPath: null,
              oggRelPath: null,
              songTitle: null,
              courses: [],
              diff: 3,
              songGenreLabel: '',
              hidden: false,
              analysisBranch: null
            }
          ]
        }
      ]
    })
    expect(() => exportSetToFolder(db, userDataDir, created.id, destDir)).toThrow()
  })

  it('validateSet reports each unassigned slot instead of throwing', () => {
    const incompleteSet: DaniSet = {
      ...buildTestSet('set-x'),
      ranks: [
        {
          ...buildTestSet('set-x').ranks[0],
          songSlots: [
            {
              id: 'slot-0',
              tjaRelPath: null,
              oggRelPath: null,
              songTitle: null,
              courses: [],
              diff: 3,
              songGenreLabel: '',
              hidden: false,
              analysisBranch: null
            },
            songSlot('slot-1', 'song-b', '曲B', 3)
          ]
        }
      ]
    }

    const report = validateSet(incompleteSet)
    expect(report.isValid).toBe(false)
    expect(report.issues).toEqual([
      { rankIndex: 0, rankName: '五級', slotIndex: 0, reason: '曲が割り当てられていない' }
    ])
  })

  it('validateSet reports no issues for a complete set', () => {
    expect(validateSet(buildTestSet('set-y')).isValid).toBe(true)
  })

  it('exports a complete set to a folder matching the sample structure', () => {
    const created = createSet(db, { title: 'テストセット', index: 0 })
    saveSet(db, buildTestSet(created.id))

    const report = exportSetToFolder(db, userDataDir, created.id, destDir)
    expect(report.ranksExported).toBe(1)

    const setRoot = join(destDir, '001-テストセット')
    expect(existsSync(join(setRoot, 'dani.def'))).toBe(true)
    expect(readDaniDef(readFileSync(join(setRoot, 'dani.def')))).toEqual({
      title: 'テストセット',
      index: 0
    })

    const rankDir = join(setRoot, '0,五級')
    const raw = readDaniJson(readFileSync(join(rankDir, 'dani.json')))
    expect(raw.tja_Path).toEqual(['fumen\\曲A.tja', 'fumen\\曲B.tja', 'fumen\\曲C.tja'])
    expect(raw.tja_Diff).toEqual([3, 3, 2])
    expect(raw.theme_Genre).toEqual(['HitCount'])
    expect(raw.theme_Borders[0].values).toEqual([{ red: 100, gold: 120 }])

    expect(existsSync(join(rankDir, 'fumen', '曲A.tja'))).toBe(true)
    expect(existsSync(join(rankDir, 'fumen', '曲A.ogg'))).toBe(true)
    expect(readFileSync(join(rankDir, 'fumen', '曲A.tja'), 'utf-8')).toContain('TITLE:曲A')
  })

  it('re-exporting the same set overwrites its remembered folder in place', () => {
    const created = createSet(db, { title: 'テストセット', index: 0 })
    saveSet(db, buildTestSet(created.id))

    const first = exportSetToFolder(db, userDataDir, created.id, destDir)
    expect(first.folderPath).toBe(join(destDir, '001-テストセット'))

    const second = exportSetToFolder(db, userDataDir, created.id, destDir)
    expect(second.folderPath).toBe(join(destDir, '001-テストセット'))
    expect(existsSync(join(destDir, '002-テストセット'))).toBe(false)
  })

  it('remembers the exported folder on the set', () => {
    const created = createSet(db, { title: 'テストセット', index: 0 })
    saveSet(db, buildTestSet(created.id))

    expect(loadSet(db, created.id)?.lastExportPath).toBeNull()
    exportSetToFolder(db, userDataDir, created.id, destDir)
    expect(loadSet(db, created.id)?.lastExportPath).toBe(join(destDir, '001-テストセット'))
  })

  it('exports afresh when the remembered folder was deleted outside the app', () => {
    const created = createSet(db, { title: 'テストセット', index: 0 })
    saveSet(db, buildTestSet(created.id))

    exportSetToFolder(db, userDataDir, created.id, destDir)
    rmSync(join(destDir, '001-テストセット'), { recursive: true, force: true })

    // The remembered path is gone, so numbering restarts at the freed number.
    const report = exportSetToFolder(db, userDataDir, created.id, destDir)
    expect(report.folderPath).toBe(join(destDir, '001-テストセット'))
    expect(existsSync(join(destDir, '001-テストセット'))).toBe(true)
  })

  it('gives each different set its own numbered folder', () => {
    const a = createSet(db, { title: 'セットA', index: 0 })
    saveSet(db, buildTestSet(a.id, 'セットA'))
    const b = createSet(db, { title: 'セットB', index: 1 })
    saveSet(db, buildTestSet(b.id, 'セットB'))

    exportSetToFolder(db, userDataDir, a.id, destDir)
    exportSetToFolder(db, userDataDir, b.id, destDir)

    expect(existsSync(join(destDir, '001-セットA'))).toBe(true)
    expect(existsSync(join(destDir, '002-セットB'))).toBe(true)
  })

  it('does not flag a conflict for the folder the set already owns', () => {
    const created = createSet(db, { title: 'テストセット', index: 0 })
    saveSet(db, buildTestSet(created.id))

    exportSetToFolder(db, userDataDir, created.id, destDir)
    expect(checkExportFolderConflict(db, created.id, destDir)).toBeNull()
  })

  it('flags a conflict for a same-titled folder this set did not export', () => {
    const created = createSet(db, { title: 'テストセット', index: 0 })
    saveSet(db, buildTestSet(created.id))

    // A folder left behind by some other export of the same title.
    mkdirSync(join(destDir, '001-テストセット'), { recursive: true })

    const conflict = checkExportFolderConflict(db, created.id, destDir)
    expect(conflict?.folderName).toBe('001-テストセット')
  })

  it('exports a complete set to a zip file with correctly named entries', async () => {
    const created = createSet(db, { title: 'ZipSet', index: 0 })
    saveSet(db, buildTestSet(created.id, 'ZipSet'))

    const zipPath = join(destDir, 'output.zip')
    const report = await exportSetToZip(db, userDataDir, created.id, zipPath)
    expect(report.ranksExported).toBe(1)
    expect(existsSync(zipPath)).toBe(true)

    const yauzl = await import('yauzl')
    const entryNames: string[] = await new Promise((resolve, reject) => {
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

    expect(entryNames).toContain('ZipSet/dani.def')
    expect(entryNames).toContain('ZipSet/0,五級/dani.json')
    expect(entryNames).toContain('ZipSet/0,五級/fumen/曲A.tja')
  })
})
