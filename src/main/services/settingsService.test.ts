import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../../shared/types/settings'
import { readSettings, updateSettings, writeSettings } from './settingsService'

describe('settingsService', () => {
  let dir: string
  let settingsPath: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'anasoko-settings-'))
    settingsPath = join(dir, 'settings.json')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns defaults when no settings file exists', () => {
    expect(readSettings(settingsPath)).toEqual(DEFAULT_SETTINGS)
  })

  it('persists a full write and reads it back', () => {
    writeSettings(settingsPath, { audioPreviewEnabled: false, defaultExportFormat: 'zip' })
    expect(readSettings(settingsPath)).toEqual({
      audioPreviewEnabled: false,
      defaultExportFormat: 'zip'
    })
  })

  it('merges a partial patch onto existing settings', () => {
    writeSettings(settingsPath, DEFAULT_SETTINGS)
    const updated = updateSettings(settingsPath, { audioPreviewEnabled: false })
    expect(updated).toEqual({ audioPreviewEnabled: false, defaultExportFormat: 'folder' })
    expect(readSettings(settingsPath)).toEqual(updated)
  })
})
