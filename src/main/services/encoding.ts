import iconv from 'iconv-lite'

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf])

export type DetectedEncoding = 'utf8-bom' | 'utf8' | 'cp932'

export function hasUtf8Bom(buf: Buffer): boolean {
  return buf.length >= 3 && buf.subarray(0, 3).equals(UTF8_BOM)
}

export function stripUtf8Bom(buf: Buffer): Buffer {
  return hasUtf8Bom(buf) ? buf.subarray(3) : buf
}

const strictUtf8Decoder = new TextDecoder('utf-8', { fatal: true })

/**
 * Auto-detects TJA/text encoding: UTF-8 BOM takes priority. Otherwise, a
 * strict UTF-8 decode is attempted first (using TextDecoder's `fatal`
 * mode, which throws on any invalid byte sequence) since valid UTF-8 has a
 * distinctive continuation-byte structure that legacy cp932 (Shift-JIS)
 * text essentially never satisfies by coincidence. cp932 decoding is used
 * as the fallback for anything that isn't valid UTF-8, since cp932 maps
 * every byte value to *some* character and therefore can't be validated by
 * itself (it never "fails" even on garbage input).
 */
export function decodeTextAutoDetect(buf: Buffer): { text: string; encoding: DetectedEncoding } {
  if (hasUtf8Bom(buf)) {
    return { text: stripUtf8Bom(buf).toString('utf-8'), encoding: 'utf8-bom' }
  }

  try {
    return { text: strictUtf8Decoder.decode(buf), encoding: 'utf8' }
  } catch {
    return { text: iconv.decode(buf, 'cp932'), encoding: 'cp932' }
  }
}

export function decodeCp932(buf: Buffer): string {
  return iconv.decode(buf, 'cp932')
}

export function encodeCp932(text: string): Buffer {
  return iconv.encode(text, 'cp932')
}

/** Reads dani.json bytes as UTF-8, tolerating an optional leading BOM. */
export function decodeUtf8WithOptionalBom(buf: Buffer): string {
  return stripUtf8Bom(buf).toString('utf-8')
}

/** Encodes text as UTF-8 with a leading BOM, matching the on-disk dani.json format. */
export function encodeUtf8WithBom(text: string): Buffer {
  return Buffer.concat([UTF8_BOM, Buffer.from(text, 'utf-8')])
}
