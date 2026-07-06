import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { readDaniDef, writeDaniDef } from './daniDefCodec'

const FIXTURE_PATH = join(__dirname, '__fixtures__', 'dani.def')

describe('daniDefCodec', () => {
  it('reads the real sample dani.def (cp932) correctly', () => {
    const buf = readFileSync(FIXTURE_PATH)
    const def = readDaniDef(buf)
    expect(def).toEqual({ title: '2025本家段位', index: 0 })
  })

  it('round-trips read -> write -> read to the same value', () => {
    const original = readDaniDef(readFileSync(FIXTURE_PATH))
    const rewritten = writeDaniDef(original)
    expect(readDaniDef(rewritten)).toEqual(original)
  })

  it('writes cp932 bytes with no trailing newline, matching the sample format', () => {
    const buf = writeDaniDef({ title: 'テスト', index: 3 })
    expect(buf.toString('utf-8')).not.toBe('TITLE:テスト\r\nINDEX:3')
    expect(readDaniDef(buf)).toEqual({ title: 'テスト', index: 3 })
  })
})
