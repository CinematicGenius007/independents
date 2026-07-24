import { describe, expect, it } from 'vitest'
import { deriveOrder } from './order'

describe('deriveOrder', () => {
  it('is stable regardless of the input array order', () => {
    const a = ['p3', 'p1', 'p2', 'p4']
    const b = ['p1', 'p2', 'p3', 'p4']
    const c = ['p4', 'p3', 'p2', 'p1']
    const nonce = 'game-nonce-xyz'
    const orderA = deriveOrder(a, nonce)
    const orderB = deriveOrder(b, nonce)
    const orderC = deriveOrder(c, nonce)
    expect(orderA).toEqual(orderB)
    expect(orderA).toEqual(orderC)
  })

  it('returns a permutation of the input ids', () => {
    const ids = ['host', 'alice', 'bob', 'carol']
    const order = deriveOrder(ids, 'nonce')
    expect(order.slice().sort()).toEqual(ids.slice().sort())
    expect(order.length).toBe(ids.length)
  })

  it('produces different orders for different nonces (spot check)', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const orders = new Set<string>()
    for (const nonce of ['n1', 'n2', 'n3', 'n4', 'n5']) {
      orders.add(deriveOrder(ids, nonce).join(','))
    }
    expect(orders.size).toBeGreaterThan(1)
  })

  it('handles a single player', () => {
    expect(deriveOrder(['solo'], 'nonce')).toEqual(['solo'])
  })

  it('handles an empty player list', () => {
    expect(deriveOrder([], 'nonce')).toEqual([])
  })

  it('is deterministic across repeated calls with identical inputs', () => {
    const ids = ['x', 'y', 'z']
    expect(deriveOrder(ids, 'n')).toEqual(deriveOrder(ids, 'n'))
  })
})
