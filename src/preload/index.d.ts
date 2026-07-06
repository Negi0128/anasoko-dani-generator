import { ElectronAPI } from '@electron-toolkit/preload'
import type { DaniSet, DaniSetSummary } from '../shared/types/daniSet'
import type { AppSettings } from '../shared/types/settings'
import type { RemoveSongResult, Song } from '../shared/types/song'
import type { ImportReport } from '../shared/types/importReport'

interface Api {
  ping: () => Promise<string>
  settings: {
    get: () => Promise<AppSettings>
    update: (patch: Partial<AppSettings>) => Promise<AppSettings>
  }
  songLibrary: {
    list: () => Promise<Song[]>
    importFiles: (tjaPath: string) => Promise<Song>
    remove: (id: string, force?: boolean) => Promise<RemoveSongResult>
  }
  dialogs: {
    pickTjaFile: () => Promise<string | null>
    pickSaveFolder: () => Promise<string | null>
    pickSaveZip: (defaultName: string) => Promise<string | null>
    pickImportFolder: () => Promise<string | null>
    pickImportZip: () => Promise<string | null>
  }
  sets: {
    list: () => Promise<DaniSetSummary[]>
    create: (input: { title: string; index: number }) => Promise<DaniSet>
    load: (id: string) => Promise<DaniSet | null>
    save: (set: DaniSet) => Promise<DaniSet | null>
    remove: (id: string) => Promise<void>
    duplicate: (id: string, newTitle: string) => Promise<DaniSet | null>
    exportToFolder: (id: string, destDir: string) => Promise<{ ranksExported: number }>
    exportToZip: (id: string, destZipPath: string) => Promise<{ ranksExported: number }>
    importFromFolder: (sourceDir: string) => Promise<ImportReport>
    importFromZip: (sourceZipPath: string) => Promise<ImportReport>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
