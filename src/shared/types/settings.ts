import { DEFAULT_ROLL_SPEED, DEFAULT_SHORT_ROLL_COMP, ShortRollComp } from './rollSpeed'

export interface AppSettings {
  audioPreviewEnabled: boolean
  defaultExportFormat: 'folder' | 'zip'
  defaultSongFolder: string | null
  defaultDaniFolder: string | null
  rollSpeed: number
  shortRollComp: ShortRollComp
}

export const DEFAULT_SETTINGS: AppSettings = {
  audioPreviewEnabled: true,
  defaultExportFormat: 'folder',
  defaultSongFolder: null,
  defaultDaniFolder: null,
  rollSpeed: DEFAULT_ROLL_SPEED,
  shortRollComp: DEFAULT_SHORT_ROLL_COMP
}
