import { existsSync, readFileSync, writeFileSync } from 'fs'
import { AppSettings, DEFAULT_SETTINGS } from '../../shared/types/settings'

export function readSettings(settingsPath: string): AppSettings {
  if (!existsSync(settingsPath)) {
    return { ...DEFAULT_SETTINGS }
  }
  try {
    const parsed = JSON.parse(readFileSync(settingsPath, 'utf-8'))
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function writeSettings(settingsPath: string, settings: AppSettings): void {
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
}

export function updateSettings(
  settingsPath: string,
  patch: Partial<AppSettings>
): AppSettings {
  const next = { ...readSettings(settingsPath), ...patch }
  writeSettings(settingsPath, next)
  return next
}
