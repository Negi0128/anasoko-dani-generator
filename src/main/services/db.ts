import Database from 'better-sqlite3'
import initSql from '../store/migrations/001_init.sql?raw'
import removeSongLibrarySql from '../store/migrations/002_remove_song_library.sql?raw'
import dropTemplatesSql from '../store/migrations/004_drop_templates.sql?raw'
import addAnalysisBranchSql from '../store/migrations/005_add_analysis_branch.sql?raw'

interface Migration {
  version: number
  sql: string
}

// version 3 (templates table) was added and then removed before release; 004
// drops it for any dev DB that already advanced to version 3.
const MIGRATIONS: Migration[] = [
  { version: 1, sql: initSql },
  { version: 2, sql: removeSongLibrarySql },
  { version: 4, sql: dropTemplatesSql },
  { version: 5, sql: addAnalysisBranchSql }
]

export function openDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
}

function runMigrations(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number
  const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version
  )
  for (const migration of pending) {
    db.transaction(() => {
      db.exec(migration.sql)
      db.pragma(`user_version = ${migration.version}`)
    })()
  }
}
