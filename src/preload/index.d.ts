import { ElectronAPI } from '@electron-toolkit/preload'
import type { DaniSet, DaniSetSummary } from '../shared/types/daniSet'
import type { AppSettings } from '../shared/types/settings'
import type { SongAssetResult, SongCourse } from '../shared/types/song'
import type { ImportReport } from '../shared/types/importReport'
import type { ValidationReport } from '../shared/types/validationReport'
import type { ExportFolderConflict } from '../shared/types/exportConflict'
import type { ExportReport } from '../shared/types/exportReport'
import type { CreatePackParamsInput, CreatePackResult } from '../shared/types/pack'

interface Api {
  ping: () => Promise<string>
  app: {
    setDirty: (isDirty: boolean) => void
    reportError: (context: string, message: string, detail: string) => void
  }
  settings: {
    get: () => Promise<AppSettings>
    update: (patch: Partial<AppSettings>) => Promise<AppSettings>
  }
  songAssets: {
    assign: (tjaPath: string) => Promise<SongAssetResult>
    analyze: (tjaRelPath: string) => Promise<SongCourse[]>
  }
  dialogs: {
    pickTjaFile: () => Promise<string | null>
    pickSaveFolder: () => Promise<string | null>
    pickSaveZip: (defaultName: string) => Promise<string | null>
    pickImportFolder: () => Promise<string | null>
    pickImportZip: () => Promise<string | null>
    pickFolder: (title: string) => Promise<string | null>
    pickSaveAnskpack: (defaultName: string) => Promise<string | null>
    pickFolders: (title: string) => Promise<string[] | null>
  }
  sets: {
    list: () => Promise<DaniSetSummary[]>
    create: (input: { title: string; index: number }) => Promise<DaniSet>
    load: (id: string) => Promise<DaniSet | null>
    save: (set: DaniSet) => Promise<DaniSet | null>
    remove: (id: string) => Promise<void>
    duplicate: (id: string, newTitle: string) => Promise<DaniSet | null>
    exportToFolder: (
      id: string,
      destDir: string,
      overwriteFolderName?: string
    ) => Promise<ExportReport>
    checkExportFolderConflict: (id: string, destDir: string) => Promise<ExportFolderConflict | null>
    exportToZip: (id: string, destZipPath: string) => Promise<ExportReport>
    importFromFolder: (sourceDir: string) => Promise<ImportReport>
    importFromZip: (sourceZipPath: string) => Promise<ImportReport>
    validate: (id: string) => Promise<ValidationReport>
  }
  pack: {
    create: (params: CreatePackParamsInput) => Promise<CreatePackResult>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
