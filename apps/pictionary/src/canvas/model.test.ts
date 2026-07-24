import { describe, expect, it } from 'vitest'
import type { CanvasOp } from './types'
import { applyCanvasOp, commitLocalOp, createCanvasState, undoLastBy } from './model'

const clear = (id: number, by = 'drawer'): CanvasOp => ({ t: 'clear', id, by })

describe('canvas model', () => {
  it('allocates monotonic local ids', () => {
    const first = commitLocalOp(createCanvasState(), (id) => clear(id))
    const second = commitLocalOp(first.state, (id) => clear(id))
    expect([first.op.id, second.op.id]).toEqual([0, 1])
    expect(second.state.nextId).toBe(2)
  })

  it('ignores duplicate network delivery by author and id', () => {
    const op = clear(4, 'peer-a')
    const once = applyCanvasOp(createCanvasState(), op)
    expect(applyCanvasOp(once, op)).toBe(once)
  })

  it('undoes only the latest op by the requesting author', () => {
    const state = {
      nextId: 3,
      ops: [clear(0, 'drawer'), clear(0, 'peer'), clear(1, 'drawer')],
    }
    expect(undoLastBy(state, 'drawer').ops).toEqual([clear(0, 'drawer'), clear(0, 'peer')])
    expect(undoLastBy(state, 'missing')).toBe(state)
  })
})

