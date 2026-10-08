import { describe, expect, it } from 'vitest'
import { MemoryHub, settle } from './memory-transport'
import { Session } from './session'
import { isRoomCode, generateRoomCode, parseRoomIdFromHash } from './room'
import { createRng } from '../engine/rng'
import { legalMoves, needsDeal } from '../engine/rules'
import type { GameState } from '../engine/types'

/**
 * Timers are collapsed to nothing so a whole game runs inside a test. The
 * queue is drained in order, which keeps the host's "one pending action at a
 * time" guarantee under test rather than being papered over.
 */
function fakeClock() {
  const queue: { id: number; fn: () => void }[] = []
  let nextId = 1
  return {
    schedule: (fn: () => void) => {
      const id = nextId++
      queue.push({ id, fn })
      return id
    },
    cancel: (handle: unknown) => {
      const index = queue.findIndex(item => item.id === handle)
      if (index !== -1) queue.splice(index, 1)
    },
    /** Runs pending timers, letting each one schedule the next. */
    async run(steps = 500) {
      for (let i = 0; i < steps && queue.length > 0; i++) {
        const next = queue.shift()!
        next.fn()
        await settle(4)
      }
    },
    pending: () => queue.length,
  }
}

function sessionFor(hub: MemoryHub, id: string, name: string, host: boolean, clock = fakeClock()) {
  const session = new Session({
    transport: hub.join(id),
    name,
    host,
    seed: 1234,
    schedule: clock.schedule,
    cancel: clock.cancel,
  })
  return { session, clock }
}

describe('room codes', () => {
  it('generates codes that pass their own check', () => {
    const rng = createRng(9)
    for (let i = 0; i < 50; i++) expect(isRoomCode(generateRoomCode(rng))).toBe(true)
  })

  it('reads a code out of a link and rejects rubbish', () => {
    expect(parseRoomIdFromHash('#room=kp4tq')).toBe('KP4TQ')
    expect(parseRoomIdFromHash('#room=OOOOO')).toBeNull()
    expect(parseRoomIdFromHash('#nothing')).toBeNull()
  })
})

describe('a hosted room', () => {
  it('seats a peer that joins, and tells everyone', async () => {
    const hub = new MemoryHub()
    const { session: host } = sessionFor(hub, 'a-host', 'Ana', true)
    const { session: guest } = sessionFor(hub, 'b-guest', 'Bo', false)
    await settle()

    expect(host.view().seats.map(s => s.name)).toEqual(['Ana', 'Bo'])
    expect(guest.view().seats.map(s => s.name)).toEqual(['Ana', 'Bo'])
    expect(guest.view().seatIndex).toBe(1)
    expect(guest.view().isHost).toBe(false)
    expect(guest.view().hostId).toBe('a-host')
  })

  it('will not start under two players, and starts at two', async () => {
    const hub = new MemoryHub()
    const { session: host } = sessionFor(hub, 'a-host', 'Ana', true)
    host.start()
    expect(host.view().started).toBe(false)

    const { session: guest } = sessionFor(hub, 'b-guest', 'Bo', false)
    await settle()
    host.start()
    await settle()
    expect(host.view().started).toBe(true)
    expect(guest.view().started).toBe(true)
  })

  it('replicates a whole game to every peer, tile for tile', async () => {
    const hub = new MemoryHub()
    const clock = fakeClock()
    const { session: host } = sessionFor(hub, 'a-host', 'Ana', true, clock)
    const { session: guest } = sessionFor(hub, 'b-guest', 'Bo', false, clock)
    await settle()
    host.addBot('artisan')
    await settle()
    host.start()
    await clock.run(4)
    await settle()

    let guard = 0
    while (host.view().state?.phase !== 'over' && guard++ < 600) {
      const view = host.view()
      const state = view.state as GameState
      if (state.phase === 'offer' && !host.view().isHost === false) {
        const seat = state.current
        const actor = seat === 0 ? host : seat === 1 ? guest : null
        if (actor) {
          const moves = legalMoves(state)
          if (moves.length > 0) actor.play(moves[0])
          await settle()
        }
      }
      await clock.run(2)
      await settle()
    }

    const hostState = host.view().state!
    const guestState = guest.view().state!
    expect(hostState.phase).toBe('over')
    expect(guestState).toEqual(hostState)
    expect(hostState.winners?.length).toBeGreaterThan(0)
  })

  it('refuses a move from a peer whose turn it is not', async () => {
    const hub = new MemoryHub()
    const clock = fakeClock()
    const { session: host } = sessionFor(hub, 'a-host', 'Ana', true, clock)
    const { session: guest } = sessionFor(hub, 'b-guest', 'Bo', false, clock)
    await settle()
    host.start()
    await clock.run(3)
    await settle()

    const state = guest.view().state!
    expect(state.current).toBe(0)
    const before = JSON.stringify(state)
    guest.play(legalMoves(state)[0])
    await settle()
    expect(guest.view().notice).toBe('It is not your turn.')
    expect(JSON.stringify(host.view().state)).toBe(before)
  })

  it('catches up a peer that arrives after the first round', async () => {
    const hub = new MemoryHub()
    const clock = fakeClock()
    const { session: host } = sessionFor(hub, 'a-host', 'Ana', true, clock)
    sessionFor(hub, 'b-guest', 'Bo', false, clock)
    await settle()
    host.addBot('master')
    await settle()
    host.start()
    await clock.run(6)
    await settle()

    const { session: watcher } = sessionFor(hub, 'c-late', 'Cy', false, clock)
    await settle()
    await clock.run(2)
    await settle()

    expect(watcher.view().started).toBe(true)
    expect(watcher.view().state).toEqual(host.view().state)
    expect(watcher.view().seatIndex).toBeNull()
  })
})

describe('when the host disappears', () => {
  it('hands the bag to the surviving player and the game goes on', async () => {
    const hub = new MemoryHub()
    const clock = fakeClock()
    const { session: host } = sessionFor(hub, 'a-host', 'Ana', true, clock)
    const { session: guest } = sessionFor(hub, 'b-guest', 'Bo', false, clock)
    await settle()
    host.addBot('artisan')
    await settle()
    host.start()
    await clock.run(6)
    await settle()

    const beforeState = guest.view().state!
    expect(beforeState).not.toBeNull()

    hub.drop('a-host')
    await settle()

    expect(guest.view().isHost).toBe(true)
    expect(guest.view().hostId).toBe('b-guest')
    expect(guest.view().seats[0].present).toBe(false)

    // The abandoned seat is played by the house from here on, so the only
    // player left has to be able to finish the game on their own.
    let guard = 0
    while (guest.view().state?.phase !== 'over' && guard++ < 800) {
      const state = guest.view().state!
      if (state.phase === 'offer' && state.current === 1) {
        const moves = legalMoves(state)
        if (moves.length > 0) guest.play(moves[0])
      }
      await clock.run(2)
      await settle(2)
    }

    const after = guest.view().state!
    expect(after.phase).toBe('over')
    expect(after.round).toBeGreaterThan(beforeState.round)
    // The seat whose player walked out kept playing, and scored.
    expect(after.players[0].score).toBeGreaterThan(0)
  })

  it('lets a returning player take their seat back', async () => {
    const hub = new MemoryHub()
    const clock = fakeClock()
    const { session: host } = sessionFor(hub, 'a-host', 'Ana', true, clock)
    sessionFor(hub, 'b-guest', 'Bo', false, clock)
    await settle()
    host.start()
    await clock.run(4)
    await settle()

    hub.drop('b-guest')
    await settle()
    expect(host.view().seats[1].present).toBe(false)

    const { session: returning } = sessionFor(hub, 'b-again', 'Bo', false, clock)
    await settle()
    await clock.run(2)
    await settle()

    expect(host.view().seats[1]).toMatchObject({ id: 'b-again', name: 'Bo', present: true })
    expect(returning.view().seatIndex).toBe(1)
    expect(host.view().state!.players[1].id).toBe('b-again')
  })
})

describe('a solo game', () => {
  it('plays itself against the house with no peers at all', async () => {
    const hub = new MemoryHub()
    const clock = fakeClock()
    const { session } = sessionFor(hub, 'solo', 'Solo', true, clock)
    session.addBot('master')
    session.addBot('apprentice')
    session.start()
    await clock.run(4)

    let guard = 0
    while (session.view().state?.phase !== 'over' && guard++ < 800) {
      const state = session.view().state!
      if (state.phase === 'offer' && state.current === 0) {
        const moves = legalMoves(state)
        if (moves.length > 0) session.play(moves[0])
      }
      await clock.run(2)
      await settle(2)
    }
    expect(session.view().state?.phase).toBe('over')
    expect(session.view().seats).toHaveLength(3)
  })
})

describe('between rounds', () => {
  it('deals as soon as everyone present has seen the count, not when the clock runs out', async () => {
    const hub = new MemoryHub()
    const delays: number[] = []
    const queue: { id: number; fn: () => void }[] = []
    let nextId = 1
    const clock = {
      schedule: (fn: () => void, ms: number) => {
        delays.push(ms)
        queue.push({ id: nextId, fn })
        return nextId++
      },
      cancel: (handle: unknown) => {
        const index = queue.findIndex(item => item.id === handle)
        if (index !== -1) queue.splice(index, 1)
      },
    }
    const make = (id: string, name: string, host: boolean) => {
      const session = new Session({ transport: hub.join(id), name, host, seed: 7, ...clock })
      return session
    }
    const host = make('a-host', 'Ana', true)
    const guest = make('b-guest', 'Bo', false)
    await settle()
    host.start()
    await settle()

    let guard = 0
    while (!needsDeal(host.view().state!) && guard++ < 400) {
      const state = host.view().state!
      if (state.phase === 'offer') {
        const actor = state.current === 0 ? host : guest
        actor.play(legalMoves(state)[0])
      } else {
        queue.shift()?.fn()
      }
      await settle()
    }
    const state = host.view().state!
    expect(needsDeal(state)).toBe(true)
    expect(queue).toHaveLength(1)

    // One of two has seen it: still waiting.
    const before = delays.length
    host.seen(state.round)
    await settle()
    expect(delays.length).toBe(before)

    guest.seen(state.round)
    await settle()
    expect(delays.at(-1)).toBeLessThan(1000)
    queue.shift()!.fn()
    await settle()
    expect(needsDeal(host.view().state!)).toBe(false)
    expect(guest.view().state).toEqual(host.view().state)
  })
})

describe('when a player reloads', () => {
  it('a reloaded host rejoins its own seat and the table carries on', async () => {
    const hub = new MemoryHub()
    const clock = fakeClock()
    const { session: host } = sessionFor(hub, 'a-host', 'Ana', true, clock)
    const { session: guest } = sessionFor(hub, 'b-guest', 'Bo', false, clock)
    await settle()
    host.addBot('artisan')
    await settle()
    host.start()
    await clock.run(6)
    await settle()
    const before = guest.view().state!

    // Same browser id, empty memory: what a page reload does.
    const { session: reloaded } = sessionFor(hub, 'a-host', 'Ana', false, clock)
    await settle()
    await clock.run(2)
    await settle()

    expect(guest.view().isHost).toBe(true)
    expect(reloaded.view().hostId).toBe('b-guest')
    expect(reloaded.view().seatIndex).toBe(0)
    expect(reloaded.view().state).toEqual(guest.view().state)
    expect(reloaded.view().state!.round).toBeGreaterThanOrEqual(before.round)
  })

  it('a lone player who reloads can take the head of an empty table', async () => {
    const hub = new MemoryHub()
    const { session } = sessionFor(hub, 'a-host', 'Ana', false)
    await settle()
    expect(session.view().hostId).toBe('')
    session.becomeHost()
    expect(session.view().isHost).toBe(true)
    expect(session.view().seats).toHaveLength(1)
  })
})
