import type { Player, PlayerId, PlayerProfile, Unsubscribe } from '../shared/types'
import type { Transport } from './protocol'
import { electHost } from './presence'

export interface RoomRoster {
  players(): Player[]
  hostId(): PlayerId
  onChange(listener: (players: Player[], hostId: PlayerId) => void): Unsubscribe
  stop(): void
}

export function createRoomRoster(
  transport: Transport,
  profile: PlayerProfile,
  joinedAt = Date.now(),
): RoomRoster {
  const self: Player = { ...profile, id: transport.selfId, joinedAt, connection: 'connected' }
  const players = new Map<PlayerId, Player>([[self.id, self]])
  const listeners = new Set<(players: Player[], hostId: PlayerId) => void>()
  let hostId = self.id
  let stopped = false

  const snapshot = () => [...players.values()].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
  const recomputeHost = () => {
    hostId = electHost(snapshot())
  }
  const emit = () => {
    const current = snapshot()
    listeners.forEach((listener) => listener(current, hostId))
  }
  const broadcastRoster = () => {
    if (hostId === self.id) transport.sendCtrl({ t: 'roster', players: snapshot(), hostId })
  }
  const sendHello = (to?: PlayerId) => transport.sendCtrl({ t: 'hello', profile: self, joinedAt }, to)

  const unsubCtrl = transport.onCtrl((message, from) => {
    if (message.t === 'hello') {
      if (hostId !== self.id) return
      const lastJoinedAt = Math.max(...snapshot().map((player) => player.joinedAt))
      // The established host stamps join order. A newcomer cannot seize host
      // authority by claiming an earlier local clock value.
      players.set(from, { ...message.profile, id: from, joinedAt: Math.max(Date.now(), lastJoinedAt + 1), connection: 'connected' })
      recomputeHost()
      emit()
      broadcastRoster()
    } else if (message.t === 'roster') {
      const proposed = message.players.some((player) => player.id === self.id)
        ? message.players
        : [...message.players, self]
      const elected = electHost(proposed)
      if (from !== elected || message.hostId !== elected) return
      const bootstrapping = players.size === 1 && players.has(self.id) && transport.peers().includes(from)
      if (!bootstrapping && from !== hostId) return
      players.clear()
      proposed.forEach((player) => players.set(player.id, player))
      hostId = elected
      emit()
    }
  })
  const unsubJoin = transport.onPeerJoin((id) => sendHello(id))
  const unsubLeave = transport.onPeerLeave((id) => {
    if (!players.delete(id)) return
    recomputeHost()
    emit()
    broadcastRoster()
  })

  for (const peerId of transport.peers()) sendHello(peerId)

  return {
    players: snapshot,
    hostId: () => hostId,
    onChange: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    stop: () => {
      if (stopped) return
      stopped = true
      unsubCtrl()
      unsubJoin()
      unsubLeave()
      listeners.clear()
    },
  }
}
