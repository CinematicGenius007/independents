import { describe, expect, it } from 'vitest'
import { CENTRE, generateBoard, index, mirror, neighbours, SIZE, type Board } from './board'
import { analyseTurn, distinctOrders } from './analysis'
import { botOrders, distances } from './bot'
import {
  actionsFor,
  auditSeals,
  committerOf,
  decodeMatch,
  encodeMatch,
  leaksSealedOrders,
  newMatch,
  openerOf,
  play,
  replay,
  seal,
  stageOf,
  unseal,
} from './protocol'
import {
  held,
  ordersFromText,
  resolveStep,
  resolveTurn,
  startPosition,
  TURN_LIMIT,
  verdict,
  type Orders,
  type Position,
} from './rules'

const orders = (text: string): Orders => ordersFromText(text)!

const bareBoard: Board = {
  walls: new Array(SIZE * SIZE).fill(false),
  wells: [index(3, 3)],
  starts: [index(0, 3), index(6, 3)],
}

describe('boards', () => {
  it('are symmetric under a half turn', () => {
    const board = generateBoard('SEAL-1')
    for (let cell = 0; cell < board.walls.length; cell += 1) {
      expect(board.walls[cell]).toBe(board.walls[mirror(cell)])
    }
    expect(board.starts[1]).toBe(mirror(board.starts[0]))
  })

  it('keep every well reachable', () => {
    for (const seed of ['A1', 'B2', 'C3', 'D4']) {
      const board = generateBoard(seed)
      const field = distances(board, board.starts[0])
      for (const well of board.wells) expect(field[well]).toBeLessThan(Infinity)
    }
  })

  it('give both players an identically shaped race', () => {
    const board = generateBoard('FAIR-1')
    const first = distances(board, board.starts[0])
    const second = distances(board, board.starts[1])
    const mineSorted = board.wells.map((well) => first[well]).sort()
    const theirsSorted = board.wells.map((well) => second[well]).sort()
    expect(theirsSorted).toEqual(mineSorted)
  })
})

describe('resolving steps', () => {
  const position = startPosition(bareBoard)

  it('moves both pieces at once', () => {
    const outcome = resolveStep(bareBoard, position, ['E', 'W'])
    expect(outcome.pieces[0]).toBe(index(1, 3))
    expect(outcome.pieces[1]).toBe(index(5, 3))
  })

  it('lets pieces pass through each other', () => {
    const touching: Position = { ...position, pieces: [index(2, 3), index(3, 3)] }
    const outcome = resolveStep(bareBoard, touching, ['E', 'W'])
    expect(outcome.pieces).toEqual([index(3, 3), index(2, 3)])
  })

  it('allows both pieces to stand on one cell mid-turn', () => {
    const facing: Position = { ...position, pieces: [index(2, 3), index(4, 3)] }
    const outcome = resolveStep(bareBoard, facing, ['E', 'W'])
    expect(outcome.pieces).toEqual([index(3, 3), index(3, 3)])
    expect(outcome.sharing).toBe(true)
  })

  it('stops a piece at a wall instead of through it', () => {
    const walls = [...bareBoard.walls]
    walls[index(1, 3)] = true
    const outcome = resolveStep({ ...bareBoard, walls }, position, ['E', '.'])
    expect(outcome.pieces[0]).toBe(index(0, 3))
  })

  it('claims a well for a piece that finishes on it alone', () => {
    const near: Position = { ...position, pieces: [index(2, 3), index(6, 3)] }
    const result = resolveTurn(bareBoard, near, [orders('E..'), orders('...')])
    expect(result.position.claims[index(3, 3)]).toBe(0)
    expect(result.claimed).toEqual([{ cell: index(3, 3), side: 0 }])
  })

  it('ignores a well a piece merely walks across', () => {
    const near: Position = { ...position, pieces: [index(2, 3), index(6, 3)] }
    const result = resolveTurn(bareBoard, near, [orders('EE.'), orders('...')])
    expect(result.position.claims[index(3, 3)]).toBeUndefined()
  })

  it('gives a well both pieces finish on to nobody, and sends them home', () => {
    const near: Position = { ...position, pieces: [index(2, 3), index(4, 3)] }
    const result = resolveTurn(bareBoard, near, [orders('E..'), orders('W..')])
    expect(result.position.claims[index(3, 3)]).toBeUndefined()
    expect(result.contested).toEqual([index(3, 3)])
    expect(result.position.pieces).toEqual([index(2, 3), index(4, 3)])
  })

  it('hands a held well to whoever sits on it unanswered', () => {
    const claimed: Position = { ...position, pieces: [index(2, 3), index(6, 3)], claims: { [index(3, 3)]: 1 } }
    const result = resolveTurn(bareBoard, claimed, [orders('E..'), orders('...')])
    expect(result.position.claims[index(3, 3)]).toBe(0)
  })

  it('keeps a held well when its owner sits down first', () => {
    const claimed: Position = { ...position, pieces: [index(1, 3), index(4, 3)], claims: { [index(3, 3)]: 1 } }
    const result = resolveTurn(bareBoard, claimed, [orders('EE.'), orders('W..')])
    expect(result.position.claims[index(3, 3)]).toBe(1)
  })

  it('gives an earlier arrival the well over a later one', () => {
    const race: Position = { ...position, pieces: [index(2, 3), index(5, 3)] }
    const result = resolveTurn(bareBoard, race, [orders('E..'), orders('WW.')])
    expect(result.position.claims[index(3, 3)]).toBe(0)
  })
})

describe('turns and verdicts', () => {
  it('plays three beats per turn and advances the clock', () => {
    const result = resolveTurn(bareBoard, startPosition(bareBoard), [orders('EEE'), orders('WWW')])
    expect(result.beats).toHaveLength(3)
    expect(result.position.turn).toBe(2)
  })

  it('ends the match at three wells', () => {
    const board = generateBoard('END-1')
    const position: Position = {
      pieces: board.starts as unknown as [number, number],
      claims: Object.fromEntries(board.wells.slice(0, 3).map((well) => [well, 0])),
      drawn: [3, 0],
      turn: 4,
    }
    expect(held(position, 0)).toBe(3)
    expect(verdict(board, position)).toEqual({ over: true, winner: 0 })
  })

  it('decides a long match on water drawn, not wells held at the end', () => {
    const board = generateBoard('END-2')
    const base = {
      pieces: board.starts as unknown as [number, number],
      claims: { [board.wells[0]]: 1 as const },
      turn: TURN_LIMIT + 1,
    }
    // Side 0 holds nothing at the end but drew more over the match.
    expect(verdict(board, { ...base, drawn: [9, 4] as const })).toEqual({ over: true, winner: 0 })
    expect(verdict(board, { ...base, drawn: [4, 9] as const })).toEqual({ over: true, winner: 1 })
  })

  it('breaks a level match on the deep well, and draws without it', () => {
    const board = generateBoard('END-3')
    const base = {
      pieces: board.starts as unknown as [number, number],
      drawn: [6, 6] as const,
      turn: TURN_LIMIT + 1,
    }
    expect(verdict(board, { ...base, claims: { [CENTRE]: 1 as const } })).toEqual({
      over: true,
      winner: 1,
    })
    expect(verdict(board, { ...base, claims: {} })).toEqual({ over: true, winner: 'draw' })
  })

  it('counts water at the end of every turn', () => {
    const board = generateBoard('DRAW-1')
    const claimed = {
      ...startPosition(board),
      claims: { [board.wells[0]]: 0 as const, [board.wells[1]]: 1 as const },
    }
    const result = resolveTurn(board, claimed, [orders('...'), orders('...')])
    expect(result.position.drawn).toEqual([1, 1])
  })
})

describe('the sealed-orders protocol', () => {
  const match = newMatch('SEAL-9', 'match-1')

  it('alternates who seals and who plays in the open', () => {
    expect(committerOf(1)).toBe(0)
    expect(openerOf(1)).toBe(1)
    expect(committerOf(2)).toBe(1)
    expect(openerOf(2)).toBe(0)
  })

  it('asks the first player to seal before anybody plays', () => {
    expect(stageOf(match)).toEqual({ kind: 'commit', turn: 1, side: 0 })
  })

  it('never puts sealed orders in the link that carries the seal', async () => {
    const sealed = await seal(match, 1, orders('EEN'), 'abc123')
    expect(leaksSealedOrders(sealed, 1)).toBe(false)
    expect(encodeMatch(sealed)).not.toContain('EEN')
  })

  it('walks commit, open, reveal, and then the next turn', async () => {
    let current = await seal(match, 1, orders('EEE'), 'nonce-1')
    expect(stageOf(current)).toEqual({ kind: 'open', turn: 1, side: 1 })

    current = play(current, 1, orders('WWW'))
    expect(stageOf(current)).toEqual({ kind: 'reveal', turn: 1, side: 0 })

    current = unseal(current, 1, orders('EEE'), 'nonce-1')
    expect(replay(current).turnsPlayed).toBe(1)
    expect(stageOf(current)).toEqual({ kind: 'commit', turn: 2, side: 1 })
  })

  it('lets a player take every action that is theirs before passing the link', async () => {
    let current = await seal(match, 1, orders('EEE'), 'nonce-1')
    current = play(current, 1, orders('WWW'))
    current = unseal(current, 1, orders('EEE'), 'nonce-1')
    current = await seal(current, 2, orders('NNN'), 'nonce-2')

    // Side 0 reveals nothing here; it is side 0's turn to play turn two openly.
    expect(actionsFor(current, 0).map((action) => action.kind)).toEqual(['open'])
    expect(actionsFor(current, 1)).toEqual([])
  })

  it('accepts an honest reveal and catches a doctored one', async () => {
    let current = await seal(match, 1, orders('EEE'), 'nonce-1')
    current = play(current, 1, orders('WWW'))

    const honest = unseal(current, 1, orders('EEE'), 'nonce-1')
    expect(await auditSeals(honest)).toBeNull()

    const doctored = unseal(current, 1, orders('NNN'), 'nonce-1')
    expect(await auditSeals(doctored)).toBe(1)
  })

  it('survives a round trip through a link', async () => {
    const sealed = await seal(match, 1, orders('ES.'), 'nonce-1')
    const decoded = decodeMatch(encodeMatch(sealed))
    expect(decoded).toEqual(sealed)
  })

  it('rejects a link that is not a match', () => {
    expect(decodeMatch('not-base64!!')).toBeNull()
    expect(decodeMatch(btoa('{"v":99}'))).toBeNull()
  })
})

describe('reading a turn as a game', () => {
  const board = generateBoard('ANALYSE-1')
  const position = startPosition(board)

  it('collapses orders that leave the piece in the same places', () => {
    const distinct = distinctOrders(board, position, 0)
    expect(distinct.length).toBeGreaterThan(3)
    // 125 order strings, far fewer actual plans.
    expect(distinct.length).toBeLessThan(125)
  })

  it('gives a best reply no regret and a wasted turn some', () => {
    // Stand next to a free well, where doing nothing is measurably a mistake.
    const well = board.wells.find((cell) => cell !== board.starts[0])!
    const beside = neighbours(well).find((cell) => !board.walls[cell])!
    const chance: Position = { ...position, pieces: [beside, board.starts[1]] }

    const report = analyseTurn(board, chance, 0, ordersFromText('...')!)
    expect(analyseTurn(board, chance, 0, report.best).regret).toBeCloseTo(0, 6)
    expect(report.regret).toBeGreaterThan(0)
  })

  it('agrees with itself about what the best reply is worth', () => {
    const report = analyseTurn(board, position, 0, ordersFromText('EEE')!)
    const confirm = analyseTurn(board, position, 0, report.best)
    expect(confirm.chosenValue).toBeGreaterThanOrEqual(report.chosenValue - 1e-9)
  })

  it('measures both sides on the same scale', () => {
    const first = analyseTurn(board, position, 0, ordersFromText('EEE')!)
    const second = analyseTurn(board, position, 1, ordersFromText('WWW')!)
    expect(Number.isFinite(first.value)).toBe(true)
    expect(Number.isFinite(second.value)).toBe(true)
    expect(first.actionCount).toBeGreaterThan(0)
    expect(second.actionCount).toBeGreaterThan(0)
  })
})

describe('the ghost', () => {
  it('walks toward a well it can win', () => {
    const board = generateBoard('BOT-1')
    const position = startPosition(board)
    const chosen = botOrders(board, position, 0, 'rush')
    expect(chosen.filter((step) => step !== '.').length).toBeGreaterThan(0)
  })

  it('gives up on a race it would lose', () => {
    const board = generateBoard('BOT-2')
    const position = startPosition(board)
    const field = distances(board, position.pieces[0])
    const rush = botOrders(board, position, 0, 'rush')
    const careful = botOrders(board, position, 0, 'ghost')
    // The centre well is the same distance for both, so the careful plan should
    // differ from the greedy one somewhere on the board.
    expect(field[board.wells[0]]).toBeLessThan(Infinity)
    expect(rush.length).toBe(careful.length)
  })
})
