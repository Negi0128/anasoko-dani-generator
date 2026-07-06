import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export function getUserDataDir(): string {
  return app.getPath('userData')
}

export function getDbPath(): string {
  return join(getUserDataDir(), 'anasoko-library.sqlite3')
}

export function getSongsDir(): string {
  return join(getUserDataDir(), 'songs')
}

export function getThumbnailsDir(): string {
  return join(getUserDataDir(), 'thumbnails')
}

export function getSettingsPath(): string {
  return join(getUserDataDir(), 'settings.json')
}

export function ensureStorageDirs(): void {
  for (const dir of [getUserDataDir(), getSongsDir(), getThumbnailsDir()]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }
}
