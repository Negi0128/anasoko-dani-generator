import Database from 'better-sqlite3'
import initSql from '../store/migrations/001_init.sql?raw'

interface Migration {
  version: number
  sql: string
}

const MIGRATIONS: Migration[] = [{ version: 1, sql: initSql }]

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
