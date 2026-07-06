import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS } from '../shared/constants'
import type { DaniSet, DaniSetSummary } from '../shared/types/daniSet'
import type { AppSettings } from '../shared/types/settings'
import type { RemoveSongResult, Song } from '../shared/types/song'
import type { ImportReport } from '../shared/types/importReport'

const api = {
  ping: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.ping),
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
    update: (patch: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, patch)
  },
  songLibrary: {
    list: (): Promise<Song[]> => ipcRenderer.invoke(IPC_CHANNELS.songLibraryList),
    importFiles: (tjaPath: string): Promise<Song> =>
      ipcRenderer.invoke(IPC_CHANNELS.songLibraryImportFiles, tjaPath),
    remove: (id: string, force?: boolean): Promise<RemoveSongResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.songLibraryRemove, id, force)
  },
  dialogs: {
    pickTjaFile: (): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.dialogsPickTjaFile),
    pickSaveFolder: (): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.dialogsPickSaveFolder),
    pickSaveZip: (defaultName: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.dialogsPickSaveZip, defaultName),
    pickImportFolder: (): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.dialogsPickImportFolder),
    pickImportZip: (): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.dialogsPickImportZip)
  },
  sets: {
    list: (): Promise<DaniSetSummary[]> => ipcRenderer.invoke(IPC_CHANNELS.setsList),
    create: (input: { title: string; index: number }): Promise<DaniSet> =>
      ipcRenderer.invoke(IPC_CHANNELS.setsCreate, input),
    load: (id: string): Promise<DaniSet | null> => ipcRenderer.invoke(IPC_CHANNELS.setsLoad, id),
    save: (set: DaniSet): Promise<DaniSet | null> => ipcRenderer.invoke(IPC_CHANNELS.setsSave, set),
    remove: (id: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.setsDelete, id),
    duplicate: (id: string, newTitle: string): Promise<DaniSet | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.setsDuplicate, id, newTitle),
    exportToFolder: (id: string, destDir: string): Promise<{ ranksExported: number }> =>
      ipcRenderer.invoke(IPC_CHANNELS.setsExportToFolder, id, destDir),
    exportToZip: (id: string, destZipPath: string): Promise<{ ranksExported: number }> =>
      ipcRenderer.invoke(IPC_CHANNELS.setsExportToZip, id, destZipPath),
    importFromFolder: (sourceDir: string): Promise<ImportReport> =>
      ipcRenderer.invoke(IPC_CHANNELS.setsImportFromFolder, sourceDir),
    importFromZip: (sourceZipPath: string): Promise<ImportReport> =>
      ipcRenderer.invoke(IPC_CHANNELS.setsImportFromZip, sourceZipPath)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.api = api
}
