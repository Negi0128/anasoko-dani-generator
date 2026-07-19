import Database from 'better-sqlite3'
import { registerDialogsIpc } from './dialogs.ipc'
import { registerPackIpc } from './pack.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerSetsIpc } from './sets.ipc'
import { registerSongAssetsIpc } from './songAssets.ipc'

export function registerIpc(db: Database.Database): void {
  registerSettingsIpc()
  registerDialogsIpc()
  registerSongAssetsIpc()
  registerSetsIpc(db)
  registerPackIpc(db)
}
