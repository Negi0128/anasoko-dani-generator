import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto'

/**
 * Reward-zip encryption scheme for .anskpack v3, shared byte-for-byte with the
 * Monitor (.NET) side. Values here must match docs/pack-integration-plan.md
 * section 9.8 exactly — they are the proven interop constants, not placeholders.
 */
export const EMBEDDED_SECRET = 'AnasokoHiroba.AnasPack.v1|c4a92f61e8d05b37'

export const SALT = Buffer.from([
  0x5a, 0x0e, 0x91, 0x3c, 0xb7, 0x44, 0xd2, 0x68, 0x1f, 0xa3, 0x7d, 0x59, 0xe6, 0x02, 0x8b, 0xc5
])

const PBKDF2_ITERATIONS = 100000
const KEY_LENGTH_BYTES = 32
const IV_LENGTH_BYTES = 16

/**
 * key = PBKDF2(password = EMBEDDED_SECRET + "|" + ruleId, salt = SALT,
 *              iterations = 100000, hash = SHA-256, length = 32 bytes)
 * Mirrors .NET's Rfc2898DeriveBytes(string, byte[], int, HashAlgorithmName.SHA256).GetBytes(32).
 */
export function deriveKey(ruleId: string): Buffer {
  const password = `${EMBEDDED_SECRET}|${ruleId}`
  return pbkdf2Sync(password, SALT, PBKDF2_ITERATIONS, KEY_LENGTH_BYTES, 'sha256')
}

/** Output = [IV(16 bytes)][AES-256-CBC/PKCS7 ciphertext]. */
export function encrypt(plaintext: Buffer, ruleId: string): Buffer {
  const key = deriveKey(ruleId)
  const iv = randomBytes(IV_LENGTH_BYTES)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return Buffer.concat([iv, ciphertext])
}

/** Inverse of encrypt(); used by the self-test after writing a pack. */
export function decrypt(payload: Buffer, ruleId: string): Buffer {
  const key = deriveKey(ruleId)
  const iv = payload.subarray(0, IV_LENGTH_BYTES)
  const ciphertext = payload.subarray(IV_LENGTH_BYTES)
  const decipher = createDecipheriv('aes-256-cbc', key, iv)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}
