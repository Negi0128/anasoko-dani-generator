import { describe, expect, it } from 'vitest'
import {
  analysisBorderFor,
  analysisHitCountBorder,
  analysisMaxComboBorder,
  analysisRollBorder
} from './analysisBorder'

describe('analysisRollBorder', () => {
  it('matches the reference example: 100 rolls of which 50 are balloon', () => {
    // 通常連打50 + 風船50 = 解析値100 -> 金=100, 赤=round(50/1.1)+(50-1)=45+49=94
    expect(analysisRollBorder({ donKatsu: 0, normalRoll: 50, balloon: 50 }, 1.1)).toEqual({
      gold: 100,
      red: 94
    })
  })

  it('gold is the raw estimate and red is always looser', () => {
    const border = analysisRollBorder({ donKatsu: 0, normalRoll: 200, balloon: 0 }, 1.1)
    expect(border.gold).toBe(200)
    expect(border.red).toBe(182) // round(200/1.1)
    expect(border.red).toBeLessThan(border.gold)
  })

  it('never drives the balloon part below zero when there are no balloons', () => {
    expect(analysisRollBorder({ donKatsu: 0, normalRoll: 0, balloon: 0 }, 1.1)).toEqual({
      gold: 0,
      red: 0
    })
  })

  it('ignores note count entirely', () => {
    const withNotes = analysisRollBorder({ donKatsu: 999, normalRoll: 50, balloon: 50 }, 1.1)
    const withoutNotes = analysisRollBorder({ donKatsu: 0, normalRoll: 50, balloon: 50 }, 1.1)
    expect(withNotes).toEqual(withoutNotes)
  })
})

describe('analysisHitCountBorder', () => {
  it('golds the theoretical max and back-calculates red from every part', () => {
    // 金 = 1000+50+50 = 1100
    // 赤 = round(1000/1.1) + round(50/1.1) + (50-1) = 909 + 45 + 49 = 1003
    expect(analysisHitCountBorder({ donKatsu: 1000, normalRoll: 50, balloon: 50 }, 1.1)).toEqual({
      gold: 1100,
      red: 1003
    })
  })

  it('keeps red under gold', () => {
    const border = analysisHitCountBorder({ donKatsu: 800, normalRoll: 30, balloon: 10 }, 1.1)
    expect(border.red).toBeLessThan(border.gold)
  })
})

describe('analysisMaxComboBorder', () => {
  it('golds a full combo of the note count and back-calculates red', () => {
    // 連打・風船はコンボに乗らないので音符数のみ: 金=1000, 赤=round(1000/1.1)=909
    expect(analysisMaxComboBorder({ donKatsu: 1000, normalRoll: 50, balloon: 50 }, 1.1)).toEqual({
      gold: 1000,
      red: 909
    })
  })

  it('never exceeds the note count on gold', () => {
    const border = analysisMaxComboBorder({ donKatsu: 500, normalRoll: 999, balloon: 999 }, 1.1)
    expect(border.gold).toBe(500)
  })
})

describe('analysisBorderFor', () => {
  const breakdown = { donKatsu: 1000, normalRoll: 50, balloon: 50 }

  it('routes each analyzable stat kind to its own formula', () => {
    expect(analysisBorderFor('Roll', breakdown)).toEqual({ gold: 100, red: 94 })
    expect(analysisBorderFor('MaxCombo', breakdown)).toEqual({ gold: 1000, red: 909 })
    expect(analysisBorderFor('HitCount', breakdown)).toEqual({ gold: 1100, red: 1003 })
  })

  it('falls back to a divisor of 1 for stat kinds with no configured multiplier', () => {
    // 未設定のラベルは HitCount 扱い + 倍率1 なので赤=金になる
    const border = analysisBorderFor('Unknown', breakdown)
    expect(border.gold).toBe(1100)
    // 倍率1なので割り算では減らず、風船の取りこぼし1個分だけ金より低くなる
    expect(border.red).toBe(1099) // 1000 + 50 + (50-1)
  })
})
