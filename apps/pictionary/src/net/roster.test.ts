import { describe, expect, it } from 'vitest'
import { createMesh } from './memory-transport'
import { createRoomRoster } from './roster'

describe('room roster', () => {
  it('exchanges profiles and deterministically migrates the host', () => {
    const { mesh, transports } = createMesh(2)
    const first = createRoomRoster(transports[0], { id: 'ignored', nickname: 'Ada', color: '#F5D311', avatar: 0 }, 10)
    const second = createRoomRoster(transports[1], { id: 'ignored', nickname: 'Bo', color: '#F2603C', avatar: 1 }, 20)

    // The second roster sends hello to the already-present first peer; the first broadcasts reconciliation.
    expect(first.players().map((player) => player.nickname)).toEqual(['Ada', 'Bo'])
    expect(second.players().map((player) => player.nickname)).toEqual(['Ada', 'Bo'])
    expect(first.hostId()).toBe('peer-0')
    expect(second.hostId()).toBe('peer-0')

    mesh.leave('peer-0')
    expect(second.players().map((player) => player.nickname)).toEqual(['Bo'])
    expect(second.hostId()).toBe('peer-1')
    first.stop()
    second.stop()
  })

  it('does not let an established guest replace the host with a forged roster', () => {
    const { transports } = createMesh(2)
    const first = createRoomRoster(transports[0], { id: 'x', nickname: 'Ada', color: '#F5D311', avatar: 0 }, 10)
    const second = createRoomRoster(transports[1], { id: 'y', nickname: 'Bo', color: '#F2603C', avatar: 1 }, 20)
    transports[1].sendCtrl({
      t: 'roster',
      hostId: 'peer-1',
      players: [
        { id: 'peer-1', nickname: 'Bo', color: '#F2603C', avatar: 1, connection: 'connected', joinedAt: 0 },
        { id: 'peer-0', nickname: 'Ada', color: '#F5D311', avatar: 0, connection: 'connected', joinedAt: 10 },
      ],
    }, 'peer-0')
    expect(first.hostId()).toBe('peer-0')
    expect(second.hostId()).toBe('peer-0')
    first.stop()
    second.stop()
  })

  it('converges when both singleton peers exchange hello before either roster', () => {
    const { transports } = createMesh(2)
    const queued: Array<() => void> = []
    let released = false
    for (const transport of transports) {
      const sendCtrl = transport.sendCtrl.bind(transport)
      transport.sendCtrl = (message, to) => {
        if (released) sendCtrl(message, to)
        else queued.push(() => sendCtrl(message, to))
      }
    }

    const first = createRoomRoster(transports[0], { id: 'x', nickname: 'Ada', color: '#F5D311', avatar: 0 }, 20)
    const second = createRoomRoster(transports[1], { id: 'y', nickname: 'Bo', color: '#F2603C', avatar: 1 }, 10)
    released = true
    queued.splice(0).forEach((send) => send())

    expect(first.hostId()).toBe('peer-0')
    expect(second.hostId()).toBe('peer-0')
    expect(first.players()).toEqual(second.players())
    first.stop()
    second.stop()
  })

  it('does not re-enter bootstrap after a room shrinks to one survivor', () => {
    const { mesh, transports } = createMesh(2)
    const first = createRoomRoster(transports[0], { id: 'x', nickname: 'Ada', color: '#F5D311', avatar: 0 }, 10)
    const survivor = createRoomRoster(transports[1], { id: 'y', nickname: 'Bo', color: '#F2603C', avatar: 1 }, 20)
    mesh.leave('peer-0')

    const newcomerTransport = mesh.join('aaa')
    const queued: Array<() => void> = []
    const sendCtrl = newcomerTransport.sendCtrl.bind(newcomerTransport)
    newcomerTransport.sendCtrl = (message, to) => queued.push(() => sendCtrl(message, to))
    const newcomer = createRoomRoster(newcomerTransport, { id: 'z', nickname: 'Cy', color: '#3C7DF2', avatar: 2 }, 0)
    transports[1].sendCtrl({
      t: 'hello',
      profile: { id: 'ignored', nickname: 'Bo', color: '#F2603C', avatar: 1 },
      joinedAt: 20,
      established: true,
    }, 'aaa')
    queued.splice(0).forEach((send) => send())
    expect(survivor.hostId()).toBe('peer-1')
    expect(newcomer.hostId()).toBe('peer-1')

    first.stop()
    survivor.stop()
    newcomer.stop()
  })
})
