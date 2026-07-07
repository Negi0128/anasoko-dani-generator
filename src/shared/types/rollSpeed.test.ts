import { describe, expect, it } from 'vitest'
import { computeRollHits } from './rollSpeed'

describe('computeRollHits', () => {
  it('applies the 60fps floor for durations at or under 0.10s', () => {
    expect(computeRollHits(0.08, 45, 'staged60fps')).toBe(4) // trunc(0.08*60)=4
  })

  it('applies the 55/s floor for durations between 0.10s and 0.15s', () => {
    expect(computeRollHits(0.15, 45, 'staged60fps')).toBe(8) // trunc(0.15*55)=8
  })

  it('uses the configured roll speed directly above 0.15s', () => {
    expect(computeRollHits(1, 45, 'staged60fps')).toBe(45)
  })

  it('uses the raw roll speed with no floor in normal mode', () => {
    expect(computeRollHits(0.08, 45, 'normal')).toBe(3) // trunc(0.08*45)=3
  })

  it('lets a configured roll speed above the floor take priority', () => {
    expect(computeRollHits(0.08, 70, 'staged60fps')).toBe(5) // trunc(0.08*70)=5
  })
})
