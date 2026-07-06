import { dialog, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'

export function registerDialogsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.dialogsPickTjaFile, async () => {
    const result = await dialog.showOpenDialog({
      title: '譜面ファイル(.tja)を選択(音源は同じフォルダのWAVE:指定を自動で使用します)',
      filters: [{ name: 'TJA', extensions: ['tja'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.dialogsPickSaveFolder, async () => {
    const result = await dialog.showOpenDialog({
      title: '出力先フォルダを選択',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.dialogsPickSaveZip, async (_event, defaultName: string) => {
    const result = await dialog.showSaveDialog({
      title: '出力先zipファイルを選択',
      defaultPath: `${defaultName}.zip`,
      filters: [{ name: 'ZIP', extensions: ['zip'] }]
    })
    if (result.canceled || !result.filePath) return null
    return result.filePath
  })

  ipcMain.handle(IPC_CHANNELS.dialogsPickImportFolder, async () => {
    const result = await dialog.showOpenDialog({
      title: 'インポートする段位道場セットのフォルダを選択',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.dialogsPickImportZip, async () => {
    const result = await dialog.showOpenDialog({
      title: 'インポートする段位道場セットのzipを選択',
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}
