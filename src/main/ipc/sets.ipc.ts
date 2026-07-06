import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import { IPC_CHANNELS } from '../../shared/constants'
import type { DaniSet } from '../../shared/types/daniSet'
import { createSet, deleteSet, duplicateSet, listSets, loadSet, saveSet } from '../services/setService'
import { exportSetToFolder, exportSetToZip } from '../services/exportService'
import { importSetFromFolder, importSetFromZip } from '../services/importService'
import { getSongsDir, getUserDataDir } from '../services/paths'

export function registerSetsIpc(db: Database.Database): void {
  ipcMain.handle(IPC_CHANNELS.setsList, () => listSets(db))

  ipcMain.handle(IPC_CHANNELS.setsCreate, (_event, input: { title: string; index: number }) =>
    createSet(db, input)
  )

  ipcMain.handle(IPC_CHANNELS.setsLoad, (_event, id: string) => loadSet(db, id))

  ipcMain.handle(IPC_CHANNELS.setsSave, (_event, set: DaniSet) => {
    saveSet(db, set)
    return loadSet(db, set.id)
  })

  ipcMain.handle(IPC_CHANNELS.setsDelete, (_event, id: string) => deleteSet(db, id))

  ipcMain.handle(IPC_CHANNELS.setsDuplicate, (_event, id: string, newTitle: string) =>
    duplicateSet(db, id, newTitle)
  )

  ipcMain.handle(IPC_CHANNELS.setsExportToFolder, (_event, id: string, destDir: string) =>
    exportSetToFolder(db, getUserDataDir(), id, destDir)
  )

  ipcMain.handle(IPC_CHANNELS.setsExportToZip, (_event, id: string, destZipPath: string) =>
    exportSetToZip(db, getUserDataDir(), id, destZipPath)
  )

  ipcMain.handle(IPC_CHANNELS.setsImportFromFolder, (_event, sourceDir: string) =>
    importSetFromFolder(db, getSongsDir(), sourceDir)
  )

  ipcMain.handle(IPC_CHANNELS.setsImportFromZip, (_event, sourceZipPath: string) =>
    importSetFromZip(db, getSongsDir(), sourceZipPath)
  )
}
