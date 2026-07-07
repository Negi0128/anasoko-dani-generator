import { app, shell, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import electronUpdaterPkg from 'electron-updater'
const { autoUpdater } = electronUpdaterPkg
import { IPC_CHANNELS } from '../shared/constants'
import { ensureStorageDirs, getDbPath } from './services/paths'
import { openDatabase } from './services/db'
import { registerIpc } from './ipc'

let hasUnsavedChanges = false

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('close', (event) => {
    if (!hasUnsavedChanges) return
    event.preventDefault()
    dialog
      .showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['保存せず終了', 'キャンセル'],
        defaultId: 1,
        cancelId: 1,
        message: '保存されていない変更があります。終了しますか?'
      })
      .then(({ response }) => {
        if (response === 0) {
          hasUnsavedChanges = false
          mainWindow.destroy()
        }
      })
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (is.dev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
    console.log(`[renderer] ${message} (${sourceId}:${line})`)
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[renderer] did-fail-load: ${errorCode} ${errorDescription}`)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.anasoko.dani-generator')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle(IPC_CHANNELS.ping, () => 'pong')
  ipcMain.on(IPC_CHANNELS.appSetDirty, (_event, isDirty: boolean) => {
    hasUnsavedChanges = isDirty
  })

  ensureStorageDirs()
  const db = openDatabase(getDbPath())
  registerIpc(db)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  if (!is.dev) {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('[autoUpdater] check failed:', err)
    })
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
