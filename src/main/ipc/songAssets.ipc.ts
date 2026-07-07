import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'
import { getSongsDir, getUserDataDir } from '../services/paths'
import { analyzeExistingSong, assignSongFile } from '../services/songAssetService'

export function registerSongAssetsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.songAssetsAssign, (_event, tjaPath: string) =>
    assignSongFile(getSongsDir(), tjaPath)
  )

  ipcMain.handle(IPC_CHANNELS.songAssetsAnalyze, (_event, tjaRelPath: string) =>
    analyzeExistingSong(getUserDataDir(), tjaRelPath)
  )
}
