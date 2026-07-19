import { createDecipheriv, pbkdf2Sync } from 'crypto'
import { describe, expect, it } from 'vitest'
import { decrypt, deriveKey, encrypt, EMBEDDED_SECRET, SALT } from './packCrypto'

describe('packCrypto', () => {
  it('round-trips encrypt -> decrypt for arbitrary content', () => {
    const ruleId = randomLikeRuleId()
    const plaintext = Buffer.from('こんにちは、Anasoko Hiroba! 0123456789', 'utf-8')

    const encrypted = encrypt(plaintext, ruleId)
    expect(encrypted.length).toBe(16 + Math.ceil((plaintext.length + 1) / 16) * 16)

    const decrypted = decrypt(encrypted, ruleId)
    expect(decrypted.equals(plaintext)).toBe(true)
  })

  it('produces different ciphertext each call due to random IV, but both decrypt correctly', () => {
    const ruleId = randomLikeRuleId()
    const plaintext = Buffer.from('same input', 'utf-8')

    const a = encrypt(plaintext, ruleId)
    const b = encrypt(plaintext, ruleId)

    expect(a.equals(b)).toBe(false)
    expect(decrypt(a, ruleId).equals(plaintext)).toBe(true)
    expect(decrypt(b, ruleId).equals(plaintext)).toBe(true)
  })

  it('derives keys that differ per ruleId', () => {
    const keyA = deriveKey('550e8400-e29b-41d4-a716-446655440000')
    const keyB = deriveKey('11111111-2222-3333-4444-555555555555')
    expect(keyA.equals(keyB)).toBe(false)
    expect(keyA.length).toBe(32)
  })

  // Fixed vector from docs/pack-integration-plan.md section 9.8, confirmed to
  // interop with the .NET Monitor implementation. If this test ever fails,
  // the Node side has drifted from the shared scheme and Monitor will no
  // longer be able to decrypt packs created by this app.
  it('matches the documented PBKDF2/AES-256-CBC scheme for a known rule_id', () => {
    const ruleId = '550e8400-e29b-41d4-a716-446655440000'

    // Recompute the key independently of deriveKey() to pin the exact
    // algorithm/parameters (password format, salt, iterations, digest,
    // key length) rather than just calling the function under test.
    const expectedKey = pbkdf2Sync(
      `${EMBEDDED_SECRET}|${ruleId}`,
      SALT,
      100000,
      32,
      'sha256'
    )
    expect(deriveKey(ruleId).equals(expectedKey)).toBe(true)

    expect(EMBEDDED_SECRET).toBe('AnasokoHiroba.AnasPack.v1|c4a92f61e8d05b37')
    expect(Array.from(SALT)).toEqual([
      0x5a, 0x0e, 0x91, 0x3c, 0xb7, 0x44, 0xd2, 0x68, 0x1f, 0xa3, 0x7d, 0x59, 0xe6, 0x02, 0x8b, 0xc5
    ])

    // Independently decrypt using raw node:crypto (AES-256-CBC/PKCS7) to
    // confirm encrypt()'s output format is exactly [IV(16)][ciphertext],
    // which is what a .NET Aes implementation expects to consume.
    const plaintext = Buffer.from('interop check', 'utf-8')
    const encrypted = encrypt(plaintext, ruleId)
    const iv = encrypted.subarray(0, 16)
    const ciphertext = encrypted.subarray(16)
    const decipher = createDecipheriv('aes-256-cbc', expectedKey, iv)
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    expect(decrypted.equals(plaintext)).toBe(true)
  })
})

function randomLikeRuleId(): string {
  return '550e8400-e29b-41d4-a716-446655440000'
}
