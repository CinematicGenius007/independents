import { useEffect, useRef, useState, type SetStateAction } from 'react'
import {
  appendToHistory,
  CanvasSurface,
  CanvasTools,
  BRUSH_SIZES,
  createCanvasHistory,
  decodeHistoryFromSync,
  encodeHistoryForSync,
  inkCodec,
  undoHistoryBy,
  type CanvasHistory,
  type CanvasOp,
  type ToolSettings,
} from '../canvas'
import type { Database } from '../db/types'
import { initialState, reduce, sortedScores, visibleChat, type GameState } from '../engine'
import { createGameController, createHostSequencer, createLocalStatsTracker, type GameController, type HostSequencer } from '../game'
import { createMesh, type Mesh } from '../net/mesh'
import type { RelayStatus } from '../net/protocol'
import { joinRoom } from '../net/room'
import { createRoomRoster } from '../net/roster'
import { DEFAULT_CONFIG, type GameConfig, type PlayerProfile } from '../shared/types'
import { GameScreen, LobbyScreen, ResultsScreen, RoundSummaryScreen } from '../screens'

export interface RoomViewProps {
  roomId: string
  profile: PlayerProfile
  database: Database
  onLeave(): void
}

const DEFAULT_TOOLS: ToolSettings = { tool: 'pencil', color: '#1A1A1A', size: BRUSH_SIZES.default }

async function multiplayerWords(database: Database, config: GameConfig) {
  const custom = config.customWords.map((word) => ({ word, category: null }))
  if (config.customWordsOnly) return custom
  const [rows, packs] = await Promise.all([
    database.words.byCategories(config.categories),
    database.words.packs(),
  ])
  const builtinPackIds = new Set(packs.filter((pack) => pack.isBuiltin).map((pack) => pack.packId))
  const builtin = rows
    .filter((row) => builtinPackIds.has(row.packId))
    .map((row) => ({ word: row.word, category: row.category }))
  return [...builtin, ...custom]
}

export function RoomView({ roomId, profile, database, onLeave }: RoomViewProps) {
  const [game, setGame] = useState<GameState | null>(null)
  const [inviteUrl, setInviteUrl] = useState('')
  const [history, setHistory] = useState<CanvasHistory>(() => createCanvasHistory())
  const [tools, setTools] = useState<ToolSettings>(DEFAULT_TOOLS)
  const [guess, setGuess] = useState('')
  const [chatExpanded, setChatExpanded] = useState(false)
  const [starting, setStarting] = useState(false)
  const [relayStatus, setRelayStatus] = useState<RelayStatus>('connecting')
  const [now, setNow] = useState(Date.now())
  const controllerRef = useRef<GameController | null>(null)
  const sequencerRef = useRef<HostSequencer | null>(null)
  const meshRef = useRef<Mesh | null>(null)
  const transportRef = useRef<ReturnType<typeof joinRoom>['transport'] | null>(null)
  const historyRef = useRef<CanvasHistory>(history)
  const syncedHostRef = useRef<string | null>(null)
  const turnIndexRef = useRef<number | null>(null)
  const partialStrokesRef = useRef(new Map<string, Extract<CanvasOp, { t: 'stroke' }>>())
  const resumedHostRef = useRef<string | null>(null)

  const updateHistory = (update: SetStateAction<CanvasHistory>) => {
    setHistory((current) => {
      const next = typeof update === 'function' ? update(current) : update
      historyRef.current = next
      return next
    })
  }

  useEffect(() => {
    historyRef.current = history
  }, [history])

  const ops = history.ops

  useEffect(() => {
    const index = game?.turn?.index
    if (index === undefined || index === turnIndexRef.current) return
    turnIndexRef.current = index
    const empty = createCanvasHistory()
    historyRef.current = empty
    updateHistory(empty)
    // Stroke ids restart with each turn's fresh history, so a partial stroke
    // left unfinished by a dropped `end` frame would otherwise still be sitting
    // under a key that a later turn reuses — and an `append` arriving without
    // its `begin` would splice the old turn's points into the new stroke.
    partialStrokesRef.current.clear()
  }, [game?.turn?.index])

  useEffect(() => {
    let disposed = false
    const room = joinRoom(roomId)
    const transport = room.transport
    const mesh = createMesh(transport)
    const roster = createRoomRoster(transport, profile)
    const trackStats = createLocalStatsTracker(profile.nickname)
    const self = roster.players().find((player) => player.id === transport.selfId)
    const initialGame = self
      ? reduce(initialState(roomId, transport.selfId, DEFAULT_CONFIG), { type: 'PLAYER_JOINED', player: self })
      : initialState(roomId, transport.selfId, DEFAULT_CONFIG)
    const controller = createGameController({
      initialState: initialGame,
      mesh,
      getInkSnapshot: () => encodeHistoryForSync(historyRef.current),
      applyInkSnapshot: (bytes) => {
        const synced = decodeHistoryFromSync(bytes)
        historyRef.current = synced
        updateHistory(synced)
        // The snapshot replaces the op log wholesale; strokes we were still
        // assembling belong to the log we just discarded.
        partialStrokesRef.current.clear()
      },
    })
    controllerRef.current = controller
    meshRef.current = mesh
    transportRef.current = transport
    setInviteUrl(room.url)
    setRelayStatus(room.status())
    setGame(controller.state())
    const unsubStatus = room.onStatus(setRelayStatus)
    let syncRequests = 0
    const bufferedInk: Array<{ bytes: Uint8Array; from: string }> = []
    let applyInkFrame: (bytes: Uint8Array, from: string) => void = () => undefined
    const requestStateSync = async (to: string) => {
      syncRequests += 1
      try {
        return await controller.requestSync(to)
      } finally {
        syncRequests -= 1
        if (syncRequests === 0) bufferedInk.splice(0).forEach(({ bytes, from }) => applyInkFrame(bytes, from))
      }
    }

    const reconcileRoster = (players: ReturnType<typeof roster.players>, hostId: string) => {
      const state = controller.state()
      const present = new Set(players.map((player) => player.id))
      for (const player of players) controller.dispatchLocal({ type: 'PLAYER_JOINED', player })
      for (const id of Object.keys(state.players)) {
        if (!present.has(id)) controller.dispatchLocal({ type: 'PLAYER_LEFT', playerId: id })
      }
      controller.dispatchLocal({ type: 'HOST_CHANGED', hostId })
      if (hostId !== transport.selfId && syncedHostRef.current !== hostId) {
        syncedHostRef.current = hostId
        void requestStateSync(hostId)
      }
      if (hostId === transport.selfId && state.hostId !== hostId && state.phase !== 'lobby' && resumedHostRef.current !== state.gameNonce) {
        resumedHostRef.current = state.gameNonce
        const survivor = players.find((player) => player.id !== transport.selfId)
        const recovered = survivor
          ? requestStateSync(survivor.id)
          : Promise.resolve(false)
        void recovered.then(() => multiplayerWords(database, controller.state().config)).then((words) => {
          if (disposed) return
          sequencerRef.current?.stop()
          sequencerRef.current = createHostSequencer({
            controller,
            mesh,
            words,
          })
          sequencerRef.current.resumeGame()
        })
      }
    }
    const unsubState = controller.subscribe((state) => {
      const progress = trackStats(state)
      if (progress?.turn) {
        void Promise.all([
          database.stats.bump({ ...progress.turn.record.delta, bestStreak: progress.turn.bestStreak }),
          database.stats.recordGame([progress.turn.record.entry]),
        ])
      }
      if (progress?.completedGame) void database.stats.bump({ gamesPlayed: 1 })
      setGame(state)
    })
    let unsubRoster: () => void = () => undefined
    applyInkFrame = (bytes, from) => {
      try {
        const frame = inkCodec.decodeFrame(bytes)
        const current = controller.state()
        if (current.phase !== 'drawing' || current.turn?.drawerId !== from) return
        const key = `${from}:${'id' in frame ? frame.id : ''}`
        if (frame.f === 'begin') {
          const stroke: Extract<CanvasOp, { t: 'stroke' }> = { t: 'stroke', id: frame.id, by: from, tool: frame.tool, color: frame.color, size: frame.size, pts: frame.pts }
          partialStrokesRef.current.set(key, stroke)
          updateHistory((existing) => ({ ...existing, ops: [...existing.ops.filter((op) => !(op.by === from && op.id === frame.id)), stroke] }))
        }
        if (frame.f === 'append') {
          const partial = partialStrokesRef.current.get(key)
          if (partial) {
            const stroke = { ...partial, pts: Int16Array.from([...partial.pts, ...frame.pts]) }
            partialStrokesRef.current.set(key, stroke)
            updateHistory((existing) => ({ ...existing, ops: [...existing.ops.filter((op) => !(op.by === from && op.id === frame.id)), stroke] }))
          }
        }
        if (frame.f === 'end') {
          const completed = partialStrokesRef.current.get(key)
          partialStrokesRef.current.delete(key)
          if (completed) updateHistory((existing) => appendToHistory({ ...existing, ops: existing.ops.filter((op) => !(op.by === from && op.id === frame.id)) }, completed))
        }
        if (frame.f === 'op' && frame.op.by === from) updateHistory((existing) => appendToHistory({ ...existing, ops: existing.ops.filter((op) => !(op.id === frame.op.id && op.by === frame.op.by)) }, frame.op))
        if (frame.f === 'undo') updateHistory((existing) => ({ ...existing, ops: existing.ops.filter((op) => !(op.by === from && op.id === frame.id)) }))
      } catch {
        // Ignore malformed peer ink frames; control state remains usable.
      }
    }
    const unsubInk = transport.onInk((bytes, from) => {
      if (syncRequests > 0) {
        bufferedInk.push({ bytes: bytes.slice(), from })
        return
      }
      applyInkFrame(bytes, from)
    })
    reconcileRoster(roster.players(), roster.hostId())
    // React batches the setup updates. Read back the reconciled controller
    // state so the lobby never briefly settles on the empty initial roster.
    setGame(controller.state())
    unsubRoster = roster.onChange(reconcileRoster)
    const ticker = window.setInterval(() => setNow(Date.now()), 250)

    return () => {
      disposed = true
      window.clearInterval(ticker)
      sequencerRef.current?.stop()
      unsubInk()
      unsubStatus()
      unsubState()
      unsubRoster()
      controller.stop()
      mesh.stop()
      roster.stop()
      transport.leave()
      controllerRef.current = null
      meshRef.current = null
      transportRef.current = null
    }
  // A room change intentionally creates an entirely fresh peer session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, profile.id])

  if (!game) return <main className="grid min-h-full place-items-center font-[family-name:var(--font-display)] text-2xl">Opening room…</main>

  const controller = controllerRef.current
  const commitOp = (op: CanvasOp) => {
    updateHistory((current) => appendToHistory(current, op))
  }
  const leave = () => {
    window.location.hash = ''
    onLeave()
  }

  if (game.phase === 'lobby') {
    return <LobbyScreen
      roomId={roomId}
      inviteUrl={inviteUrl}
      players={Object.values(game.players)}
      selfId={game.selfId}
      hostId={game.hostId}
      config={game.config}
      customWordsText={game.config.customWords.join('\n')}
      starting={starting}
      relayStatus={relayStatus}
      onCopyInvite={() => void navigator.clipboard.writeText(inviteUrl)}
      onConfigChange={(config) => controller?.dispatchShared({ type: 'CONFIG_CHANGED', config })}
      onCustomWordsTextChange={(text) => {
        controller?.dispatchShared({
          type: 'CONFIG_CHANGED',
          config: { ...game.config, customWords: text.split('\n').map((word) => word.trim()).filter(Boolean) },
        })
      }}
      onStart={() => {
        if (starting || game.phase !== 'lobby') return
        setStarting(true)
        void multiplayerWords(database, game.config).then((words) => {
          sequencerRef.current?.stop()
          sequencerRef.current = createHostSequencer({ controller: controller!, mesh: meshRef.current!, words })
          sequencerRef.current.startGame()
        }).finally(() => setStarting(false))
      }}
      onLeave={leave}
    />
  }

  const standings = sortedScores(game).map(({ playerId, score }) => ({ player: game.players[playerId], score })).filter((row) => row.player)
  if (game.phase === 'game_over') {
    return <ResultsScreen standings={standings} selfId={game.selfId} isHost={game.selfId === game.hostId} onPlayAgain={() => sequencerRef.current?.startGame()} onHome={leave} onStats={() => { window.location.hash = 'stats' }} />
  }
  if (game.phase === 'turn_review' || game.phase === 'turn_intro' || game.phase === 'round_break') {
    return <RoundSummaryScreen round={game.turn?.round ?? 1} totalRounds={game.config.rounds} word={game.turn?.word ?? ''} cancelled={game.turn?.word === ''} standings={standings} secondsUntilNext={game.nextTurnAt ? Math.ceil(Math.max(0, game.nextTurnAt - now) / 1000) : undefined} onLeave={leave} />
  }

  const drawer = game.turn ? game.players[game.turn.drawerId] : null
  const isDrawer = game.turn?.drawerId === game.selfId
  const canvas = <div className="flex h-full flex-col gap-3 p-3">
    <CanvasSurface baseline={history.baseline} ops={ops} nextId={Math.max(0, ...ops.filter((op) => op.by === game.selfId).map((op) => op.id + 1))} authorId={game.selfId} settings={tools} disabled={!isDrawer} onCommit={commitOp} onFrame={(frame) => transportRef.current?.sendInk(inkCodec.encodeFrame(frame))} />
    {isDrawer && <CanvasTools value={tools} onChange={setTools} onUndo={() => {
      const previous = [...ops].reverse().find((op) => op.by === game.selfId)
      updateHistory((current) => undoHistoryBy(current, game.selfId))
      if (previous) transportRef.current?.sendInk(inkCodec.encodeFrame({ f: 'undo', id: previous.id }))
    }} onClear={() => {
      const op: CanvasOp = { t: 'clear', id: Math.max(0, ...ops.map((item) => item.id + 1)), by: game.selfId }
      commitOp(op)
      transportRef.current?.sendInk(inkCodec.encodeFrame({ f: 'op', op }))
    }} />}
  </div>

  return <GameScreen
    round={game.turn?.round ?? 1}
    totalRounds={game.config.rounds}
    drawerName={drawer?.nickname ?? 'A player'}
    isDrawer={isDrawer}
    secretWord={isDrawer ? game.turn?.word ?? undefined : undefined}
    wordShape={game.turn?.wordShape ?? []}
    revealed={game.turn?.revealed ?? {}}
    secondsRemaining={game.turn ? Math.ceil(Math.max(0, game.turn.endsAt - now) / 1000) : 0}
    totalSeconds={game.config.turnSeconds}
    canvas={canvas}
    players={standings.map(({ player, score }) => ({ player, score, status: player.id === game.turn?.drawerId ? 'drawing' : game.turn && player.id in game.turn.correct ? 'guessed' : 'idle' }))}
    selfId={game.selfId}
    messages={visibleChat(game, game.selfId).map((entry) => ({ id: entry.id, author: entry.playerId ? game.players[entry.playerId]?.nickname : undefined, text: entry.text, tone: entry.kind === 'correct' ? 'success' : entry.kind === 'close' ? 'whisper' : entry.kind === 'system' ? 'system' : entry.kind === 'aside' ? 'masked' : 'chat' }))}
    guess={guess}
    chatExpanded={chatExpanded}
    onGuessChange={setGuess}
    onSubmitGuess={() => { if (controller?.submitGuess(guess)) setGuess('') }}
    onChatExpandedChange={setChatExpanded}
    onLeave={leave}
  />
}
