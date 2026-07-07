import { decodeTextAutoDetect } from './encoding'

export type Branch = 'N' | 'E' | 'M'

export interface TjaBranchAnalysis {
  donKatsuCount: number
  /** Duration (seconds) of each normal roll (note 5/6) segment, one entry per roll. */
  rollDurations: number[]
  /** Hit target for each balloon(7)/kusudama(9) note, from the branch-appropriate BALLOON* header. */
  balloonHits: number[]
}

export interface TjaCourseRollAnalysis {
  course: string
  /** True when the course actually uses #BRANCHSTART with a non-N branch that has notes. */
  hasBranches: boolean
  /** Which branch analysis should default to: 達人(M) > 玄人(E) > 普通(N), whichever hardest branch has notes. */
  defaultBranch: Branch
  /** Only contains an entry for a branch if it has note content (N is always present). */
  branches: Partial<Record<Branch, TjaBranchAnalysis>>
}

interface RawCourseBlock {
  course: string
  /** Trimmed, comment-stripped, non-empty lines between #START and #END (exclusive). */
  bodyLines: string[]
  balloonNor: number[]
  balloonExp: number[]
  balloonMas: number[]
}

function stripComment(line: string): string {
  const idx = line.indexOf('//')
  return idx === -1 ? line : line.slice(0, idx)
}

function parseBalloonList(value: string): number[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .map(Number)
}

/** Splits the file into per-COURSE raw blocks, capturing each course's own
 * BALLOON/BALLOONNOR/BALLOONEXP/BALLOONMAS header (these differ per branch,
 * since each branch can have its own balloons at different points). */
function splitIntoCourseBlocks(lines: string[]): RawCourseBlock[] {
  const blocks: RawCourseBlock[] = []

  let inCourse = false
  let inBody = false
  let course = ''
  let bodyLines: string[] = []
  let balloonNor: number[] = []
  let balloonExp: number[] = []
  let balloonMas: number[] = []

  const flush = (): void => {
    if (course) blocks.push({ course, bodyLines, balloonNor, balloonExp, balloonMas })
    inCourse = false
    inBody = false
    course = ''
    bodyLines = []
    balloonNor = []
    balloonExp = []
    balloonMas = []
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (line === '') continue

    if (!inCourse) {
      if (line.startsWith('COURSE:')) {
        inCourse = true
        course = line.slice('COURSE:'.length).trim()
      }
      continue
    }

    if (!inBody) {
      if (line === '#START') {
        inBody = true
        continue
      }
      if (line.startsWith('COURSE:')) {
        flush()
        inCourse = true
        course = line.slice('COURSE:'.length).trim()
        continue
      }
      const colonIdx = line.indexOf(':')
      if (colonIdx !== -1) {
        const key = line.slice(0, colonIdx).trim().toUpperCase()
        const value = line.slice(colonIdx + 1)
        if (key === 'BALLOON' || key === 'BALLOONNOR') balloonNor = parseBalloonList(value)
        else if (key === 'BALLOONEXP') balloonExp = parseBalloonList(value)
        else if (key === 'BALLOONMAS') balloonMas = parseBalloonList(value)
      }
      continue
    }

    if (line === '#END') {
      flush()
      continue
    }
    bodyLines.push(line)
  }
  if (inBody) flush()

  return blocks
}

/** Detects which of N/E/M actually have note content in this course, so the
 * caller can both pick a default branch (Master(達人) > Expert(玄人) >
 * Normal(普通)) and offer the others as alternatives. */
function detectBranchNotePresence(bodyLines: string[]): Record<Branch, boolean> {
  let branch: Branch | null = null
  const hasNotes: Record<Branch, boolean> = { N: false, E: false, M: false }

  for (const line of bodyLines) {
    if (/^#N\b/.test(line)) {
      branch = 'N'
      continue
    }
    if (/^#E\b/.test(line)) {
      branch = 'E'
      continue
    }
    if (/^#M\b/.test(line)) {
      branch = 'M'
      continue
    }
    if (line.startsWith('#')) continue
    if (branch && /[1-9]/.test(line)) hasNotes[branch] = true
  }

  return hasNotes
}

type MeasureEventType = 'note' | 'bpmchange' | 'measure' | 'delay'
interface MeasureEvent {
  type: MeasureEventType
  value: string | number
}

/** Runs the actual timeline analysis against one branch's content only
 * (lines tagged for a different branch are skipped; untagged/shared lines —
 * e.g. before the first #BRANCHSTART — are always included). */
function analyzeCourseBody(
  bodyLines: string[],
  globalBpm: number,
  targetBranch: Branch,
  balloonDefs: number[]
): TjaBranchAnalysis {
  let currentBranch: Branch | null = null
  let currBpm = globalBpm
  let measureVal = 1
  let totalTime = 0
  let rollStartTime: number | null = null
  let balloonIndex = 0

  let donKatsuCount = 0
  const rollDurations: number[] = []
  const balloonHits: number[] = []

  let measureEvents: MeasureEvent[] = []

  const processMeasure = (): void => {
    const nLen = measureEvents.filter((e) => e.type === 'note').length
    for (const ev of measureEvents) {
      if (ev.type === 'bpmchange') {
        currBpm = ev.value as number
      } else if (ev.type === 'measure') {
        measureVal = ev.value as number
      } else if (ev.type === 'delay') {
        totalTime += ev.value as number
      } else {
        const timePerNote = nLen > 0 && currBpm > 0 ? (240 * measureVal) / currBpm / nLen : 0
        const c = ev.value as string
        if (c === '5' || c === '6') {
          rollStartTime = totalTime
        } else if (c === '7' || c === '9') {
          balloonHits.push(balloonIndex < balloonDefs.length ? balloonDefs[balloonIndex] : 0)
          balloonIndex++
        } else if (c === '8' && rollStartTime !== null) {
          rollDurations.push(totalTime - rollStartTime)
          rollStartTime = null
        } else if (c === '1' || c === '2' || c === '3' || c === '4') {
          donKatsuCount++
        }
        totalTime += timePerNote
      }
    }
    measureEvents = []
  }

  for (const line of bodyLines) {
    if (line.startsWith('#BRANCHSTART') || line.startsWith('#BRANCHEND')) continue
    // \b avoids #M matching #MEASURE and #E matching a hypothetical #E-prefixed directive.
    if (/^#N\b/.test(line)) {
      currentBranch = 'N'
      continue
    }
    if (/^#E\b/.test(line)) {
      currentBranch = 'E'
      continue
    }
    if (/^#M\b/.test(line)) {
      currentBranch = 'M'
      continue
    }
    if (line.startsWith('#BPMCHANGE')) {
      const v = Number(line.split(/\s+/)[1])
      if (!Number.isNaN(v)) measureEvents.push({ type: 'bpmchange', value: v })
      continue
    }
    if (line.startsWith('#MEASURE')) {
      const m = /(\d+)\/(\d+)/.exec(line)
      if (m) measureEvents.push({ type: 'measure', value: Number(m[1]) / Number(m[2]) })
      continue
    }
    if (line.startsWith('#DELAY')) {
      const v = Number(line.split(/\s+/)[1])
      if (!Number.isNaN(v)) measureEvents.push({ type: 'delay', value: v })
      continue
    }
    if (line.startsWith('#')) continue

    // null = shared/untagged content (e.g. before the first #BRANCHSTART) — always included.
    if (currentBranch !== null && currentBranch !== targetBranch) continue

    for (const ch of line) {
      if (ch >= '0' && ch <= '9') {
        measureEvents.push({ type: 'note', value: ch })
      } else if (ch === ',') {
        processMeasure()
      }
    }
  }
  if (measureEvents.length > 0) processMeasure()

  return { donKatsuCount, rollDurations, balloonHits }
}

function balloonDefsFor(block: RawCourseBlock, branch: Branch): number[] {
  return branch === 'M' ? block.balloonMas : branch === 'E' ? block.balloonExp : block.balloonNor
}

/**
 * Ports NeoTJAEditor's tja_analyzer.py roll-duration extraction (same
 * BPM/#MEASURE/#DELAY timeline math, same measure/comma segmentation) so
 * the roll-speed condition helper matches numbers the user already knows
 * from that tool.
 *
 * Unlike the original (which scans the whole file for the last BPM:/BALLOON:
 * line and reuses it for every course), BALLOON headers are read per course
 * and per branch (BALLOON/BALLOONNOR for 普通, BALLOONEXP for 玄人, BALLOONMAS
 * for 達人), matching how Anasoko charts actually declare them.
 *
 * When a course branches (#BRANCHSTART), every branch that has note content
 * is analyzed (not just one), so the caller can default to the hardest
 * branch — 達人(M) > 玄人(E) > 普通(N) — while still letting the user pick a
 * different branch to reference.
 */
export function analyzeTjaRolls(buf: Buffer): TjaCourseRollAnalysis[] {
  const { text } = decodeTextAutoDetect(buf)
  const lines = text.split(/\r\n|\n/).map(stripComment)

  let globalBpm = 120
  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('BPM:')) {
      const v = Number(line.slice('BPM:'.length).trim())
      if (!Number.isNaN(v)) globalBpm = v
    }
  }

  return splitIntoCourseBlocks(lines).map((block) => {
    const hasNotes = detectBranchNotePresence(block.bodyLines)
    const hasBranches = hasNotes.E || hasNotes.M
    const defaultBranch: Branch = hasNotes.M ? 'M' : hasNotes.E ? 'E' : 'N'

    const branches: Partial<Record<Branch, TjaBranchAnalysis>> = {}
    ;(['N', 'E', 'M'] as const).forEach((branch) => {
      if (branch !== 'N' && !hasNotes[branch]) return
      branches[branch] = analyzeCourseBody(block.bodyLines, globalBpm, branch, balloonDefsFor(block, branch))
    })

    return { course: block.course, hasBranches, defaultBranch, branches }
  })
}
