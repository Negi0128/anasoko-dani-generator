export interface AppSettings {
  audioPreviewEnabled: boolean
  defaultExportFormat: 'folder' | 'zip'
}

export const DEFAULT_SETTINGS: AppSettings = {
  audioPreviewEnabled: true,
  defaultExportFormat: 'folder'
}
