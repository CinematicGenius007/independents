import { describe, expect, it } from 'vitest'
import { drawerPoints, guesserPoints } from './scoring'

describe('guesserPoints', () => {
  it('is 100 at elapsed 0', () => {
    expect(guesserPoints(0)).toBe(100)
  })

  it('is 10 at 45 seconds elapsed (100 - 90 = 10, floor boundary)', () => {
    expect(guesserPoints(45_000)).toBe(10)
  })

  it('is 10 at 60 seconds elapsed (already past the floor)', () => {
    expect(guesserPoints(60_000)).toBe(10)
  })

  it('never drops below the floor of 10 no matter how late', () => {
    expect(guesserPoints(10_000_000)).toBe(10)
  })

  it('floors partial seconds before scoring', () => {
    // 1500ms -> floor(1.5) = 1s elapsed -> 100 - 2 = 98
    expect(guesserPoints(1500)).toBe(98)
  })

  it('matches the exact formula for a mid-range elapsed time', () => {
    // 20s elapsed -> 100 - 40 = 60
    expect(guesserPoints(20_000)).toBe(60)
  })

  it('is exactly 10 just before it would go negative (44.5s -> 100-88=12, 45s -> 10)', () => {
    expect(guesserPoints(44_500)).toBe(12)
    expect(guesserPoints(45_000)).toBe(10)
  })

  it('treats negative elapsed defensively as 0 elapsed', () => {
    expect(guesserPoints(-500)).toBe(100)
  })
})

describe('drawerPoints', () => {
  it('is 0 for zero correct guessers', () => {
    expect(drawerPoints(0)).toBe(0)
  })

  it('is 10 per correct guesser', () => {
    expect(drawerPoints(1)).toBe(10)
    expect(drawerPoints(3)).toBe(30)
    expect(drawerPoints(7)).toBe(70)
  })

  it('treats negative counts defensively as 0', () => {
    expect(drawerPoints(-2)).toBe(0)
  })
})
