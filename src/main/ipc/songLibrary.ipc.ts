import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import { IPC_CHANNELS } from '../../shared/constants'
import { getSongsDir } from '../services/paths'
import { importSong, listSongs, removeSong } from '../services/songLibraryService'

export function registerSongLibraryIpc(db: Database.Database): void {
  ipcMain.handle(IPC_CHANNELS.songLibraryList, () => listSongs(db))

  ipcMain.handle(IPC_CHANNELS.songLibraryImportFiles, (_event, tjaPath: string) =>
    importSong(db, getSongsDir(), tjaPath)
  )

  ipcMain.handle(IPC_CHANNELS.songLibraryRemove, (_event, id: string, force?: boolean) =>
    removeSong(db, getSongsDir(), id, force)
  )
}
