import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import { IPC_CHANNELS } from '../../shared/constants'
import type { CreatePackParamsInput, CreatePackResult } from '../../shared/types/pack'
import { createPack } from '../services/packService'
import { getUserDataDir } from '../services/paths'

export function registerPackIpc(db: Database.Database): void {
  ipcMain.handle(
    IPC_CHANNELS.packCreate,
    (_event, params: CreatePackParamsInput): Promise<CreatePackResult> =>
      createPack({ db, userDataDir: getUserDataDir() }, params)
  )
}
