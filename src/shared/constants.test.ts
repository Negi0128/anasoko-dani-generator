import { describe, expect, it } from 'vitest'
import { IPC_CHANNELS } from './constants'

describe('IPC_CHANNELS', () => {
  it('defines the ping channel', () => {
    expect(IPC_CHANNELS.ping).toBe('app:ping')
  })
})
