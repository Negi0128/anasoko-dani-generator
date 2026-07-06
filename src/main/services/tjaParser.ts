import { decodeTextAutoDetect, DetectedEncoding } from './encoding'

export interface TjaCourse {
  course: string
  level?: number
  noteCount: number
  balloonCounts?: number[]
  scoreInit?: number
  scoreDiff?: number
}

export interface TjaParseResult {
  title?: string
  subtitle?: string
  bpm?: number
  wave?: string
  offset?: number
  courses: TjaCourse[]
  hasBranches: boolean
  encodingUsed: DetectedEncoding
}

const NOTE_CHARS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9'])

interface CourseBuilder {
  course: string
  level?: number
  balloonCounts?: number[]
  scoreInit?: number
  scoreDiff?: number
}

export function parseTja(buf: Buffer): TjaParseResult {
  const { text, encoding } = decodeTextAutoDetect(buf)
  const lines = text.split(/\r\n|\n/).map(stripComment)

  const globalHeaders: Record<string, string> = {}
  const courses: TjaCourse[] = []
  let hasBranches = false

  let currentCourse: CourseBuilder | null = null
  let inNoteBody = false
  let noteCount = 0
  let currentBranch: 'N' | 'E' | 'M' | null = null

  const finishCourse = (): void => {
    if (currentCourse) {
      courses.push({
        course: currentCourse.course,
        level: currentCourse.level,
        noteCount,
        balloonCounts: currentCourse.balloonCounts,
        scoreInit: currentCourse.scoreInit,
        scoreDiff: currentCourse.scoreDiff
      })
    }
    currentCourse = null
    noteCount = 0
    currentBranch = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line === '') continue

    if (!currentCourse) {
      if (line.startsWith('COURSE:')) {
        currentCourse = { course: line.slice('COURSE:'.length).trim() }
        continue
      }
      const header = matchHeader(line)
      if (header) {
        globalHeaders[header.key] = header.value
      }
      continue
    }

    if (!inNoteBody) {
      if (line === '#START') {
        inNoteBody = true
        continue
      }
      if (line.startsWith('COURSE:')) {
        // malformed input missing a #START/#END pair; recover by starting fresh
        finishCourse()
        currentCourse = { course: line.slice('COURSE:'.length).trim() }
        continue
      }
      const header = matchHeader(line)
      if (header) {
        applyCourseHeader(currentCourse, header.key, header.value)
      }
      continue
    }

    if (line === '#END') {
      inNoteBody = false
      finishCourse()
      continue
    }
    if (line.startsWith('#BRANCHSTART') || line.startsWith('#BRANCHEND')) {
      hasBranches = true
      continue
    }
    if (line.startsWith('#N')) {
      currentBranch = 'N'
      continue
    }
    if (line.startsWith('#E')) {
      currentBranch = 'E'
      continue
    }
    if (line.startsWith('#M')) {
      currentBranch = 'M'
      continue
    }
    if (line.startsWith('#')) {
      // other commands: #BPMCHANGE, #MEASURE, #GOGOSTART/END, #BARLINEON/OFF,
      // #DELAY, #SCROLL, #SECTION, #LEVELHOLD, etc. — none contribute notes
      continue
    }

    if (currentBranch === null || currentBranch === 'N') {
      for (const ch of line) {
        if (NOTE_CHARS.has(ch)) noteCount++
      }
    }
  }

  return {
    title: globalHeaders['TITLE'],
    subtitle: globalHeaders['SUBTITLE'],
    bpm: globalHeaders['BPM'] !== undefined ? Number(globalHeaders['BPM']) : undefined,
    wave: globalHeaders['WAVE'],
    offset: globalHeaders['OFFSET'] !== undefined ? Number(globalHeaders['OFFSET']) : undefined,
    courses,
    hasBranches,
    encodingUsed: encoding
  }
}

function stripComment(line: string): string {
  const idx = line.indexOf('//')
  return idx === -1 ? line : line.slice(0, idx)
}

function matchHeader(line: string): { key: string; value: string } | null {
  if (line.startsWith('#')) return null
  const idx = line.indexOf(':')
  if (idx === -1) return null
  return { key: line.slice(0, idx).trim().toUpperCase(), value: line.slice(idx + 1).trim() }
}

function applyCourseHeader(course: CourseBuilder, key: string, value: string): void {
  switch (key) {
    case 'LEVEL':
      course.level = Number(value)
      break
    case 'BALLOON':
    case 'BALLOONNOR':
      course.balloonCounts = value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0)
        .map(Number)
      break
    case 'SCOREINIT':
      course.scoreInit = Number(value)
      break
    case 'SCOREDIFF':
      course.scoreDiff = Number(value)
      break
    default:
      break
  }
}
