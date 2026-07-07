import { describe, expect, it } from 'vitest'
import { analyzeTjaRolls, TjaCourseRollAnalysis } from './tjaRollAnalyzer'

function tja(lines: string[]): Buffer {
  return Buffer.from(lines.join('\r\n'), 'utf-8')
}

/** Convenience accessor for the branch analysis this course defaults to. */
function defaultAnalysis(course: TjaCourseRollAnalysis) {
  const analysis = course.branches[course.defaultBranch]
  if (!analysis) throw new Error(`no analysis for default branch ${course.defaultBranch}`)
  return analysis
}

describe('analyzeTjaRolls', () => {
  it('counts don/katsu notes and computes a roll segment duration from BPM', () => {
    // BPM 120, 4/4 (default): one note per measure = 240*1/120/1 = 2.0s each;
    // the 8-note roll measure = 240*1/120/8 = 0.25s per note, roll spans
    // note index 0 ("5") through index 7 ("8") = 7 * 0.25s = 1.75s.
    const buf = tja([
      'TITLE:Test',
      'BPM:120',
      'COURSE:Oni',
      'LEVEL:8',
      '#START',
      '1,2,3,4,',
      '50000008,',
      '#END'
    ])

    const [course] = analyzeTjaRolls(buf)
    expect(course.course).toBe('Oni')
    expect(course.hasBranches).toBe(false)
    expect(course.defaultBranch).toBe('N')
    const analysis = defaultAnalysis(course)
    expect(analysis.donKatsuCount).toBe(4)
    expect(analysis.rollDurations).toHaveLength(1)
    expect(analysis.rollDurations[0]).toBeCloseTo(1.75, 5)
  })

  it('halves the roll duration when #BPMCHANGE doubles the tempo mid-roll', () => {
    // Same 8-note roll measure, but BPM doubles to 240 right before the
    // roll starts: 240*1/240/8 = 0.125s per note => 7 * 0.125s = 0.875s.
    const buf = tja([
      'TITLE:Test',
      'BPM:120',
      'COURSE:Oni',
      'LEVEL:8',
      '#START',
      '#BPMCHANGE 240',
      '50000008,',
      '#END'
    ])

    const [course] = analyzeTjaRolls(buf)
    expect(defaultAnalysis(course).rollDurations[0]).toBeCloseTo(0.875, 5)
  })

  it('accounts for #MEASURE when sizing the roll duration', () => {
    // 2/4 measure halves measure_val relative to the 4/4 default:
    // 240*0.5/120/8 = 0.125s per note => 7 * 0.125s = 0.875s.
    const buf = tja([
      'TITLE:Test',
      'BPM:120',
      'COURSE:Oni',
      'LEVEL:8',
      '#START',
      '#MEASURE 2/4',
      '50000008,',
      '#END'
    ])

    const [course] = analyzeTjaRolls(buf)
    expect(defaultAnalysis(course).rollDurations[0]).toBeCloseTo(0.875, 5)
  })

  it('keeps courses separate and, for a branched course, prefers the Master(達人) branch', () => {
    const buf = tja([
      'TITLE:Test',
      'BPM:120',
      'COURSE:Easy',
      'LEVEL:3',
      '#START',
      '1,',
      '#END',
      'COURSE:Oni',
      'LEVEL:8',
      '#START',
      '#BRANCHSTART r,1,1',
      '#N',
      '1,',
      '#E',
      '2222,',
      '#M',
      '3333,',
      '#BRANCHEND',
      '#END'
    ])

    const courses = analyzeTjaRolls(buf)
    expect(courses).toHaveLength(2)
    expect(courses[0].hasBranches).toBe(false)
    expect(courses[0].defaultBranch).toBe('N')
    expect(defaultAnalysis(courses[0]).donKatsuCount).toBe(1)

    expect(courses[1].hasBranches).toBe(true)
    expect(courses[1].defaultBranch).toBe('M')
    expect(defaultAnalysis(courses[1]).donKatsuCount).toBe(4)
    // all three branches remain available, not just the default one
    expect(courses[1].branches.N?.donKatsuCount).toBe(1)
    expect(courses[1].branches.E?.donKatsuCount).toBe(4)
    expect(courses[1].branches.M?.donKatsuCount).toBe(4)
  })

  it('falls back to Expert(玄人) when the Master branch has no notes', () => {
    const buf = tja([
      'TITLE:Test',
      'BPM:120',
      'COURSE:Oni',
      'LEVEL:8',
      '#START',
      '#BRANCHSTART r,1,1',
      '#N',
      '1,',
      '#E',
      '2222,',
      '#M',
      '#BRANCHEND',
      '#END'
    ])

    const [course] = analyzeTjaRolls(buf)
    expect(course.defaultBranch).toBe('E')
    expect(defaultAnalysis(course).donKatsuCount).toBe(4)
  })

  it('falls back to Normal(普通) when neither Master nor Expert has notes', () => {
    const buf = tja([
      'TITLE:Test',
      'BPM:120',
      'COURSE:Oni',
      'LEVEL:8',
      '#START',
      '#BRANCHSTART r,1,1',
      '#N',
      '1,',
      '#E',
      '#M',
      '#BRANCHEND',
      '#END'
    ])

    const [course] = analyzeTjaRolls(buf)
    expect(course.hasBranches).toBe(false)
    expect(course.defaultBranch).toBe('N')
    expect(defaultAnalysis(course).donKatsuCount).toBe(1)
  })

  it('includes shared content before the first #BRANCHSTART regardless of which branch wins', () => {
    const buf = tja([
      'TITLE:Test',
      'BPM:120',
      'COURSE:Oni',
      'LEVEL:8',
      '#START',
      '1,', // shared intro, before any branch tag
      '#BRANCHSTART r,1,1',
      '#N',
      '2,',
      '#M',
      '3,',
      '#BRANCHEND',
      '#END'
    ])

    const [course] = analyzeTjaRolls(buf)
    // shared "1," + Master branch's "3," = 2 don/katsu notes
    expect(defaultAnalysis(course).donKatsuCount).toBe(2)
  })

  it('reads branch-specific BALLOON headers (BALLOONMAS over BALLOON/BALLOONNOR)', () => {
    const buf = tja([
      'TITLE:Test',
      'BPM:120',
      'COURSE:Oni',
      'LEVEL:8',
      'BALLOON:5',
      'BALLOONMAS:20,30',
      '#START',
      '#BRANCHSTART r,1,1',
      '#N',
      '7,8,',
      '#M',
      '7,8,7,8,',
      '#BRANCHEND',
      '#END'
    ])

    const [course] = analyzeTjaRolls(buf)
    expect(course.branches.N?.balloonHits).toEqual([5])
    expect(course.branches.M?.balloonHits).toEqual([20, 30])
  })

  it('does not fabricate a roll when the end marker has no matching start', () => {
    const buf = tja(['TITLE:Test', 'BPM:120', 'COURSE:Oni', 'LEVEL:8', '#START', '8,', '#END'])
    const [course] = analyzeTjaRolls(buf)
    expect(defaultAnalysis(course).rollDurations).toEqual([])
  })
})
