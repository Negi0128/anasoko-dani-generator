import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'
import { AppSettings } from '../../shared/types/settings'
import { getSettingsPath } from '../services/paths'
import { readSettings, updateSettings } from '../services/settingsService'

export function registerSettingsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.settingsGet, () => readSettings(getSettingsPath()))

  ipcMain.handle(IPC_CHANNELS.settingsUpdate, (_event, patch: Partial<AppSettings>) =>
    updateSettings(getSettingsPath(), patch)
  )
}
