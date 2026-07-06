import { createWriteStream, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import yauzl from 'yauzl'
import { decodeCp932 } from './encoding'

export interface ExtractZipResult {
  warnings: string[]
}

function decodeEntryFileName(rawFileName: Buffer, utf8Flag: boolean): { name: string; warning?: string } {
  if (utf8Flag) {
    return { name: rawFileName.toString('utf-8') }
  }
  try {
    return { name: decodeCp932(rawFileName) }
  } catch {
    const fallback = rawFileName.toString('latin1')
    return {
      name: fallback,
      warning: `ファイル名のデコードに失敗しました(cp932以外の可能性): ${rawFileName.toString('hex')}`
    }
  }
}

/**
 * Extracts a zip into destDir, decoding filenames as cp932 when the
 * UTF-8 general-purpose flag is absent (the common case for
 * Japanese-authored zips) rather than assuming cp437. A single
 * undecodable entry is skipped with a warning instead of aborting
 * the whole extraction.
 */
export function extractZipToFolder(zipPath: string, destDir: string): Promise<ExtractZipResult> {
  return new Promise((resolve, reject) => {
    const warnings: string[] = []

    yauzl.open(zipPath, { lazyEntries: true, decodeStrings: false }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error('zipファイルを開けませんでした'))
        return
      }

      zipfile.on('entry', (entry) => {
        const utf8Flag = (entry.generalPurposeBitFlag & 0x800) !== 0
        const rawName = entry.fileName as unknown as Buffer
        const { name, warning } = decodeEntryFileName(rawName, utf8Flag)
        if (warning) warnings.push(warning)

        const isDirEntry = name.endsWith('/') || name.endsWith('\\')
        const targetPath = join(destDir, name)

        if (isDirEntry) {
          mkdirSync(targetPath, { recursive: true })
          zipfile.readEntry()
          return
        }

        mkdirSync(dirname(targetPath), { recursive: true })
        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) {
            warnings.push(`展開に失敗しました: ${name}`)
            zipfile.readEntry()
            return
          }
          const writeStream = createWriteStream(targetPath)
          readStream.pipe(writeStream)
          writeStream.on('close', () => zipfile.readEntry())
          writeStream.on('error', () => {
            warnings.push(`書き込みに失敗しました: ${name}`)
            zipfile.readEntry()
          })
        })
      })

      zipfile.on('end', () => {
        zipfile.close()
        resolve({ warnings })
      })
      zipfile.on('error', reject)
      zipfile.readEntry()
    })
  })
}
