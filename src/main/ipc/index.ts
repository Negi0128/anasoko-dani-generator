import Database from 'better-sqlite3'
import { registerDialogsIpc } from './dialogs.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerSetsIpc } from './sets.ipc'
import { registerSongLibraryIpc } from './songLibrary.ipc'

export function registerIpc(db: Database.Database): void {
  registerSettingsIpc()
  registerDialogsIpc()
  registerSongLibraryIpc(db)
  registerSetsIpc(db)
}
