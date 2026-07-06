import { decodeCp932, encodeCp932 } from './encoding'

export interface DaniDef {
  title: string
  index: number
}

export function readDaniDef(buf: Buffer): DaniDef {
  const text = decodeCp932(buf)
  const lines = text.split(/\r\n|\n/)
  const titleLine = lines.find((line) => line.startsWith('TITLE:'))
  const indexLine = lines.find((line) => line.startsWith('INDEX:'))

  if (titleLine === undefined || indexLine === undefined) {
    throw new Error('dani.def is missing a TITLE or INDEX line')
  }

  const index = Number(indexLine.slice('INDEX:'.length).trim())
  if (Number.isNaN(index)) {
    throw new Error(`dani.def INDEX is not a number: ${indexLine}`)
  }

  return {
    title: titleLine.slice('TITLE:'.length),
    index
  }
}

export function writeDaniDef(def: DaniDef): Buffer {
  const text = `TITLE:${def.title}\r\nINDEX:${def.index}`
  return encodeCp932(text)
}
