import { describe, expect, it } from 'vitest'
import { courseNameToIndex } from './coursePresets'

describe('courseNameToIndex', () => {
  it('maps named courses case-insensitively', () => {
    expect(courseNameToIndex('Oni')).toBe(3)
    expect(courseNameToIndex('oni')).toBe(3)
    expect(courseNameToIndex('おに')).toBe(3)
    expect(courseNameToIndex('Edit')).toBe(4)
    expect(courseNameToIndex('Ura')).toBe(4)
    expect(courseNameToIndex('裏')).toBe(4)
  })

  it('maps a bare numeric COURSE: value (0-4), per the TJA spec', () => {
    expect(courseNameToIndex('0')).toBe(0)
    expect(courseNameToIndex('1')).toBe(1)
    expect(courseNameToIndex('2')).toBe(2)
    expect(courseNameToIndex('3')).toBe(3)
    expect(courseNameToIndex('4')).toBe(4)
  })

  it('returns null for unrecognized values', () => {
    expect(courseNameToIndex('5')).toBeNull()
    expect(courseNameToIndex('Unknown')).toBeNull()
  })
})
