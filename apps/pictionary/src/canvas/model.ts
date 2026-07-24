import type { CanvasOp, CanvasState } from './types'

export function createCanvasState(): CanvasState {
  return { ops: [], nextId: 0 }
}

export function hasOp(state: CanvasState, op: Pick<CanvasOp, 'by' | 'id'>): boolean {
  return state.ops.some((candidate) => candidate.by === op.by && candidate.id === op.id)
}

/** Applies an op received from either the local drawer or a peer. Duplicate delivery is a no-op. */
export function applyCanvasOp(state: CanvasState, op: CanvasOp): CanvasState {
  if (hasOp(state, op)) return state
  return { ...state, ops: [...state.ops, op] }
}

/**
 * Allocates the next per-author id and commits the resulting local op.
 * The callback keeps id allocation in one place without weakening the frozen CanvasOp union.
 */
export function commitLocalOp(
  state: CanvasState,
  create: (id: number) => CanvasOp,
): { state: CanvasState; op: CanvasOp } {
  const op = create(state.nextId)
  return {
    op,
    state: {
      ops: [...state.ops, op],
      nextId: state.nextId + 1,
    },
  }
}

/** Undo only affects the latest operation authored by the drawer who requested it. */
export function undoLastBy(state: CanvasState, authorId: string): CanvasState {
  let index = -1
  for (let i = state.ops.length - 1; i >= 0; i--) {
    if (state.ops[i].by === authorId) {
      index = i
      break
    }
  }
  if (index < 0) return state
  return {
    ...state,
    ops: [...state.ops.slice(0, index), ...state.ops.slice(index + 1)],
  }
}
