import { describe, expect, it } from 'vitest'
import type { Board } from '../engine/board'
import { generateLevel, type Level } from '../engine/generate'
import { budgetFor, isCleanWin, movesLeft, reduce, startGame } from './state'

function levelFrom(board: Board, solution: Level['solution']): Level {
  return { board, solution, seed: 'TEST', tier: 'calm', startingWorlds: board.cells.length }
}

const openRow: Board = { width: 4, height: 1, cells: ['floor', 'floor', 'floor', 'floor'], goal: 3 }
const withPit: Board = { width: 4, height: 1, cells: ['floor', 'hazard', 'floor', 'floor'], goal: 3 }

describe('game state', () => {
  it('collapses to a win when every world lands on the goal', () => {
    const state = reduce(startGame(levelFrom(openRow, ['right'])), { type: 'move', direction: 'right' })
    expect(state.status).toBe('won')
    expect(isCleanWin(state)).toBe(true)
  })

  it('counts a win as untidy once it runs past par', () => {
    let state = startGame(levelFrom(openRow, ['right']))
    state = reduce(state, { type: 'move', direction: 'left' })
    state = reduce(state, { type: 'move', direction: 'right' })
    expect(state.status).toBe('won')
    expect(isCleanWin(state)).toBe(false)
  })

  it('refuses a fatal move but still charges for the attempt', () => {
    const start = startGame(levelFrom(withPit, ['right']))
    const state = reduce(start, { type: 'move', direction: 'right' })
    expect(state.refusal?.doomedWorlds).toBe(1)
    expect(state.belief).toEqual(start.belief)
    expect(movesLeft(state)).toBe(budgetFor(state.level) - 1)
  })

  it('strands the player when the budget runs out', () => {
    let state = startGame(levelFrom(withPit, ['right']))
    for (let i = 0; i < budgetFor(state.level); i += 1) {
      state = reduce(state, { type: 'move', direction: 'right' })
    }
    expect(state.status).toBe('stranded')
  })

  it('rewinds belief and spend on undo', () => {
    const start = startGame(levelFrom(openRow, ['right']))
    const moved = reduce(start, { type: 'move', direction: 'left' })
    const undone = reduce(moved, { type: 'undo' })
    expect(undone.belief).toEqual(start.belief)
    expect(undone.moves).toEqual([])
  })

  it('undo recovers a stranded run', () => {
    let state = startGame(levelFrom(withPit, ['right']))
    for (let i = 0; i < budgetFor(state.level); i += 1) {
      state = reduce(state, { type: 'move', direction: 'right' })
    }
    expect(reduce(state, { type: 'undo' }).status).toBe('playing')
  })

  it('ignores input after the level is finished', () => {
    const won = reduce(startGame(levelFrom(openRow, ['right'])), { type: 'move', direction: 'right' })
    expect(reduce(won, { type: 'move', direction: 'left' })).toBe(won)
  })

  it('gives generated levels a budget that fits their certified plan', () => {
    const level = generateLevel('MIST-9', 'brisk')
    const state = startGame(level)
    expect(budgetFor(level)).toBe(level.solution.length + 3)
    expect(movesLeft(state)).toBe(budgetFor(level))
  })
})
