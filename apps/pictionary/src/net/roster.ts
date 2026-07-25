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
  let hasEstablishedRoster = false
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
  const sendHello = (to?: PlayerId) => transport.sendCtrl({ t: 'hello', profile: self, joinedAt, established: hasEstablishedRoster }, to)

  const unsubCtrl = transport.onCtrl((message, from) => {
    if (message.t === 'hello') {
      if (hostId !== self.id) return
      const lastJoinedAt = Math.max(...snapshot().map((player) => player.joinedAt))
      // During the first two-peer handshake both sides begin as a singleton
      // host. Assign deterministic synthetic ranks by peer id so clock skew or
      // a forged hello cannot split authority. Once a roster exists, its host
      // stamps every later newcomer after the established players.
      const establishedIncumbent = !hasEstablishedRoster && message.established
      const bootstrap = !hasEstablishedRoster && !message.established && players.size === 1
      if (establishedIncumbent) {
        players.set(self.id, { ...self, joinedAt: 1 })
      } else if (bootstrap) {
        const [firstId] = [self.id, from].sort()
        players.set(self.id, { ...self, joinedAt: self.id === firstId ? 0 : 1 })
      }
      players.set(from, {
        ...message.profile,
        id: from,
        joinedAt: establishedIncumbent ? 0 : bootstrap ? (from < self.id ? 0 : 1) : Math.max(Date.now(), lastJoinedAt + 1),
        connection: 'connected',
      })
      hasEstablishedRoster = true
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
      if (proposed.length > 1) hasEstablishedRoster = true
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
