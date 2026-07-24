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
})
