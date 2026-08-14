import { describe, expect, it } from 'vitest'
import { initialBelief, isSolved, runPlan, step } from './belief'
import { slide, type Board, type Cell } from './board'
import { generateLevel, TIERS, type Tier } from './generate'
import { hintFrom, solve } from './solver'

/**
 * Boards are written as text so the tests read like the thing they describe.
 * `#` wall, `.` floor, `~` mud, `x` hazard, `G` goal (on floor).
 */
function parse(rows: string[]): Board {
  const width = rows[0].length
  const cells: Cell[] = []
  const gates: Record<number, number> = {}
  const gateCells: number[] = []
  let goal = -1
  rows.forEach((row, y) => {
    ;[...row].forEach((char, x) => {
      const index = y * width + x
      if (char === '#') cells.push('wall')
      else if (char === '~') cells.push('mud')
      else if (char === 'x') cells.push('hazard')
      else if (char === '>') cells.push('ratchet-right')
      else if (char === '<') cells.push('ratchet-left')
      else if (char === 'v') cells.push('ratchet-down')
      else if (char === '^') cells.push('ratchet-up')
      else if (char === 'O') {
        cells.push('gate')
        gateCells.push(index)
      } else cells.push('floor')
      if (char === 'G') goal = index
    })
  })
  if (gateCells.length === 2) {
    gates[gateCells[0]] = gateCells[1]
    gates[gateCells[1]] = gateCells[0]
  }
  return { width, height: rows.length, cells, gates, goal: goal === -1 ? 0 : goal }
}

describe('slide', () => {
  const board = parse(['.....', '..#..', '..~..', '....G', '.....'])

  it('runs until a wall stops it', () => {
    expect(slide(board, 0, 'right')).toBe(4)
    expect(slide(board, 0, 'down')).toBe(20)
  })

  it('stops on mud instead of passing through', () => {
    expect(slide(board, 22, 'up')).toBe(12)
  })

  it('stays put when the very next cell is a wall', () => {
    expect(slide(board, 2, 'down')).toBe(2)
  })

  it('reports death when a hazard lies anywhere on the path', () => {
    const deadly = parse(['..x..'])
    expect(slide(deadly, 0, 'right')).toBe('dead')
  })

  it('opens a ratchet only for a walker going its way', () => {
    const ratchet = parse(['.>...'])
    expect(slide(ratchet, 0, 'right')).toBe(4)
    expect(slide(ratchet, 4, 'left')).toBe(2)
  })

  it('throws a walker through a gate and lets go at the far side', () => {
    const gated = parse(['.O..', '....', '..O.'])
    expect(slide(gated, 0, 'right')).toBe(10)
  })

  it('never loops forever inside a ring of ratchets', () => {
    const ring = parse(['>>>>'])
    expect(() => slide(ring, 0, 'right')).not.toThrow()
  })
})

describe('belief', () => {
  it('starts as every cell that is neither wall nor hazard', () => {
    const board = parse(['..#', '.x.'])
    expect(initialBelief(board)).toEqual([0, 1, 3, 5])
  })

  it('merges worlds that land on the same cell', () => {
    const board = parse(['....'])
    const merged = step(board, initialBelief(board), 'right')
    expect(merged).toEqual([3])
  })

  it('kills the whole move when a single world would die', () => {
    const board = parse(['.x..'])
    expect(step(board, [2, 3], 'left')).toBe('dead')
  })

  it('solves only when one world remains and it sits on the goal', () => {
    const board = parse(['...G'])
    expect(isSolved(board, [3])).toBe(true)
    expect(isSolved(board, [2, 3])).toBe(false)
    expect(isSolved(board, [2])).toBe(false)
  })
})

describe('solver', () => {
  it('finds a plan that actually collapses the fog', () => {
    const board = parse(['....', '....', '....', '...G'])
    const { plan } = solve(board)
    expect(plan).not.toBeNull()
    const outcome = runPlan(board, plan!)
    expect(outcome.died).toBe(false)
    expect(isSolved(board, outcome.belief)).toBe(true)
  })

  it('returns no plan when the goal cannot hold every world', () => {
    // Two sealed rooms: nothing can ever merge across the wall.
    const board = parse(['.#.', '.#G', '.#.'])
    expect(solve(board).plan).toBeNull()
  })

  it('hints the next move of an optimal plan', () => {
    const board = parse(['....', '....', '....', '...G'])
    const hint = hintFrom(board, initialBelief(board))
    expect(hint).not.toBeNull()
    expect(['right', 'down']).toContain(hint)
  })

  it('refuses a plan that would be fatal in one world', () => {
    const board = parse(['..x.', '....', '....', '...G'])
    const { plan } = solve(board)
    if (plan) expect(runPlan(board, plan).died).toBe(false)
  })
})

describe('generator', () => {
  const tiers: Tier[] = ['calm', 'brisk', 'severe', 'reset']

  for (const tier of tiers) {
    it(`ships certified ${tier} levels`, () => {
      for (const seed of ['MIST-101', 'HAZE-202', 'DRIFT-303']) {
        const level = generateLevel(seed, tier)
        expect(level.board.width).toBe(TIERS[tier].size)
        expect(level.solution.length).toBeGreaterThanOrEqual(3)
        const outcome = runPlan(level.board, level.solution)
        expect(outcome.died).toBe(false)
        expect(isSolved(level.board, outcome.belief, level.objective)).toBe(true)
      }
    })
  }

  it('makes a reset level winnable anywhere, not only on the mark', () => {
    const level = generateLevel('RESET-1', 'reset')
    const outcome = runPlan(level.board, level.solution)
    expect(outcome.belief).toHaveLength(1)
    expect(isSolved(level.board, outcome.belief, 'reset')).toBe(true)
  })

  it('quotes the Cerny bound for the board it generated', () => {
    const level = generateLevel('BOUND-1', 'brisk')
    expect(level.cernyBound).toBe((level.startingWorlds - 1) ** 2)
    expect(level.solution.length).toBeLessThanOrEqual(level.cernyBound)
  })

  it('is deterministic for a given seed and tier', () => {
    const first = generateLevel('SMOKE-42', 'brisk')
    const second = generateLevel('SMOKE-42', 'brisk')
    expect(second.board.cells).toEqual(first.board.cells)
    expect(second.board.goal).toBe(first.board.goal)
    expect(second.solution).toEqual(first.solution)
  })

  it('treats seeds case-insensitively', () => {
    expect(generateLevel('smoke-42', 'brisk').board.cells).toEqual(
      generateLevel('SMOKE-42', 'brisk').board.cells,
    )
  })
})
