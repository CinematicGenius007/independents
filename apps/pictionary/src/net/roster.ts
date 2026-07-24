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
      players.set(from, { ...message.profile, id: from, joinedAt: message.joinedAt, connection: 'connected' })
      recomputeHost()
      emit()
      broadcastRoster()
    } else if (message.t === 'roster') {
      const proposed = message.players.some((player) => player.id === self.id)
        ? message.players
        : [...message.players, self]
      const elected = electHost(proposed)
      if (from !== elected || message.hostId !== elected) return
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
