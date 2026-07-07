import { describe, expect, it } from 'vitest'
import { openDatabase } from './db'

describe('openDatabase', () => {
  it('creates the expected tables on first run', () => {
    const db = openDatabase(':memory:')
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name)

    expect(tables).toEqual(
      expect.arrayContaining([
        'dani_sets',
        'ranks',
        'stat_kinds',
        'stat_kind_per_song_borders',
        'song_slots'
      ])
    )
    expect(tables).not.toEqual(expect.arrayContaining(['songs', 'song_courses', 'templates']))
    db.close()
  })

  it('is idempotent when opened/migrated twice against the same file', () => {
    const db1 = openDatabase(':memory:')
    const version1 = db1.pragma('user_version', { simple: true })
    db1.close()

    const db2 = openDatabase(':memory:')
    const version2 = db2.pragma('user_version', { simple: true })
    db2.close()

    expect(version1).toBe(version2)
  })

  it('enforces foreign key constraints', () => {
    const db = openDatabase(':memory:')
    expect(() => {
      db.prepare(
        "INSERT INTO ranks (id, set_id, sort_order, rank_index, rank_name, gauge_red, gauge_gold) VALUES ('r1', 'missing-set', 0, 0, '五級', 98, 100)"
      ).run()
    }).toThrow()
    db.close()
  })
})
