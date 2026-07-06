import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from './db'
import { createSet, deleteSet, duplicateSet, listSets, loadSet, saveSet } from './setService'
import type { DaniSet } from '../../shared/types/daniSet'

describe('setService', () => {
  let db: Database.Database

  beforeEach(() => {
    db = openDatabase(':memory:')
  })

  afterEach(() => {
    db.close()
  })

  it('creates and loads an empty set', () => {
    const created = createSet(db, { title: '2025本家段位', index: 0 })
    const loaded = loadSet(db, created.id)
    expect(loaded).toEqual({ id: created.id, title: '2025本家段位', index: 0, ranks: [] })
  })

  it('lists sets ordered by index with rank counts', () => {
    createSet(db, { title: 'B', index: 1 })
    createSet(db, { title: 'A', index: 0 })
    const summaries = listSets(db)
    expect(summaries.map((s) => s.title)).toEqual(['A', 'B'])
    expect(summaries.every((s) => s.rankCount === 0)).toBe(true)
  })

  it('saves and reloads a full rank tree, including mixed-continuity stat kinds', () => {
    const created = createSet(db, { title: 'Set', index: 0 })
    db.prepare(
      `INSERT INTO songs (id, title, content_hash, tja_stored_path, ogg_stored_path, tja_encoding, created_at, updated_at)
       VALUES ('song-a', 'Song A', 'hash-a', 'songs/song-a/chart.tja', 'songs/song-a/audio.ogg', 'utf8', '', '')`
    ).run()

    const set: DaniSet = {
      id: created.id,
      title: 'Set',
      index: 0,
      ranks: [
        {
          id: 'rank-0',
          rankIndex: 0,
          rankName: '五級',
          title: '',
          gauge: { red: 98, gold: 100 },
          statKinds: [{ label: 'HitCount', continuous: true, cumulativeBorder: { red: 825, gold: 874 } }],
          songSlots: [
            { id: 'slot-0', songId: null, diff: 3, songGenreLabel: 'ナムコオリジナル', hidden: false },
            { id: 'slot-1', songId: null, diff: 2, songGenreLabel: 'ナムコオリジナル', hidden: false }
          ]
        },
        {
          id: 'rank-1',
          rankIndex: 12,
          rankName: '八段',
          title: '',
          gauge: { red: 100, gold: 100 },
          statKinds: [
            { label: 'Good', continuous: true, cumulativeBorder: { red: 100, gold: 100 } },
            { label: 'Miss', continuous: true, cumulativeBorder: { red: 0, gold: 0 } },
            {
              label: 'Roll',
              continuous: false,
              perSongBorders: [
                { red: 10, gold: 20 },
                { red: 11, gold: 21 }
              ]
            }
          ],
          songSlots: [
            { id: 'slot-2', songId: 'song-a', diff: 3, songGenreLabel: 'J-POP', hidden: true },
            { id: 'slot-3', songId: null, diff: 3, songGenreLabel: 'J-POP', hidden: false }
          ]
        }
      ]
    }

    saveSet(db, set)
    const reloaded = loadSet(db, created.id)
    expect(reloaded).toEqual(set)
  })

  it('overwrites the previous rank tree on repeated saves (full-tree replace)', () => {
    const created = createSet(db, { title: 'Set', index: 0 })
    const withOneRank: DaniSet = {
      id: created.id,
      title: 'Set',
      index: 0,
      ranks: [
        {
          id: 'rank-0',
          rankIndex: 0,
          rankName: '五級',
          title: '',
          gauge: { red: 98, gold: 100 },
          statKinds: [{ label: 'HitCount', continuous: true, cumulativeBorder: { red: 1, gold: 2 } }],
          songSlots: []
        }
      ]
    }
    saveSet(db, withOneRank)
    saveSet(db, { ...withOneRank, ranks: [] })

    expect(loadSet(db, created.id)?.ranks).toEqual([])
  })

  it('deletes a set', () => {
    const created = createSet(db, { title: 'Set', index: 0 })
    deleteSet(db, created.id)
    expect(loadSet(db, created.id)).toBeNull()
  })

  it('duplicates a set with fresh rank/slot ids and an appended index', () => {
    const created = createSet(db, { title: 'Original', index: 0 })
    saveSet(db, {
      id: created.id,
      title: 'Original',
      index: 0,
      ranks: [
        {
          id: 'rank-0',
          rankIndex: 0,
          rankName: '五級',
          title: '',
          gauge: { red: 98, gold: 100 },
          statKinds: [{ label: 'HitCount', continuous: true, cumulativeBorder: { red: 1, gold: 2 } }],
          songSlots: [{ id: 'slot-0', songId: null, diff: 3, songGenreLabel: '', hidden: false }]
        }
      ]
    })

    const duplicated = duplicateSet(db, created.id, 'コピー')
    expect(duplicated?.title).toBe('コピー')
    expect(duplicated?.index).toBe(1)
    expect(duplicated?.id).not.toBe(created.id)
    expect(duplicated?.ranks[0].id).not.toBe('rank-0')
    expect(duplicated?.ranks[0].songSlots[0].id).not.toBe('slot-0')
    expect(duplicated?.ranks[0].rankName).toBe('五級')

    // original is untouched
    expect(loadSet(db, created.id)?.ranks[0].id).toBe('rank-0')
  })
})
