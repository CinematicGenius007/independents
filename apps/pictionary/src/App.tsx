import { useEffect, useState } from 'react'
import type { Database } from './db/types'
import { Showcase } from './design/Showcase'
import { createRoom, normalizeRoomCode } from './net/room'
import { usePracticeSession, type PracticePrompt } from './practice'
import { AVATAR_COLORS, type PlayerProfile, type PlayerStats } from './shared/types'
import { HomeScreen, OnboardingScreen, PracticeScreen, StatsScreen } from './screens'
import { RoomView } from './app/RoomView'

export type Route =
  | { name: 'home' }
  | { name: 'room'; roomId: string }
  | { name: 'practice' }
  | { name: 'stats' }
  | { name: 'kit' }

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#/, '')
  const params = new URLSearchParams(raw)
  const room = params.get('room')
  if (room) return { name: 'room', roomId: room.toUpperCase() }
  if (raw === 'kit') return { name: 'kit' }
  if (raw === 'practice') return { name: 'practice' }
  if (raw === 'stats') return { name: 'stats' }
  return { name: 'home' }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

function navigate(hash = ''): void {
  window.location.hash = hash
}

function PracticeRoute({ database, onExit }: { database: Database; onExit(): void }) {
  const [prompts, setPrompts] = useState<PracticePrompt[] | null>(null)
  useEffect(() => {
    void database.words.byCategories(['general', 'animals', 'food', 'objects']).then((rows) => {
      setPrompts(rows.slice(0, 5).map((row) => ({ word: row.word, category: row.category })))
    })
  }, [database])
  if (!prompts) return <main className="grid min-h-full place-items-center bg-chrome-deep pixel-heading text-[16px] leading-[16px] text-text">Opening practice…</main>
  return <PracticeSession prompts={prompts} database={database} onExit={onExit} />
}

function PracticeSession({ prompts, database, onExit }: { prompts: PracticePrompt[]; database: Database; onExit(): void }) {
  const session = usePracticeSession({
    seed: `practice:${Date.now()}`,
    prompts,
    turnDurationMs: 60_000,
    onStatsDelta: (delta) => void database.stats.bump(delta),
  })
  return <PracticeScreen {...session} onExit={onExit} />
}

function StatsRoute({ database, profile, onBack }: { database: Database; profile: PlayerProfile; onBack(): void }) {
  const [stats, setStats] = useState<PlayerStats | null>(null)
  const [history, setHistory] = useState<Awaited<ReturnType<Database['stats']['history']>>>([])
  const refresh = () => void Promise.all([database.stats.read(), database.stats.history()]).then(([nextStats, nextHistory]) => {
    setStats(nextStats)
    setHistory(nextHistory)
  })
  useEffect(refresh, [database])
  if (!stats) return <main className="grid min-h-full place-items-center bg-chrome-deep pixel-heading text-[16px] leading-[16px] text-text">Opening stats…</main>
  return <StatsScreen
    profile={profile}
    stats={stats}
    history={history}
    onBack={onBack}
    onExport={() => void database.exportBytes().then((bytes) => {
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.sqlite3' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'scribble-club.sqlite'
      anchor.click()
      URL.revokeObjectURL(url)
    }).catch(() => window.alert('Could not export this sketchbook. Please try again.'))}
    onImport={() => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.sqlite,.db,application/vnd.sqlite3'
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file || !window.confirm('Replace the local sketchbook with this backup?')) return
        void file.arrayBuffer()
          .then((buffer) => database.importBytes(new Uint8Array(buffer)))
          .then(refresh)
          .catch(() => window.alert('That file could not be imported. Your current sketchbook was kept.'))
      }
      input.click()
    }}
    onReset={() => {
      if (!window.confirm('Reset all local stats and game history? This cannot be undone.')) return
      void database.stats.reset().then(refresh).catch(() => window.alert('Could not reset stats. Please try again.'))
    }}
  />
}

export function App() {
  const route = useRoute()
  const [database, setDatabase] = useState<Database | null>(null)
  const [databaseError, setDatabaseError] = useState(false)
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState(0)
  const [color, setColor] = useState(AVATAR_COLORS[0])
  const [roomCode, setRoomCode] = useState('')

  useEffect(() => {
    void import('./db')
      .then(({ openDatabase }) => openDatabase())
      .then(async (db) => {
        const restored = await db.players.current()
        setDatabase(db)
        setProfile(restored)
        if (restored) {
          setNickname(restored.nickname)
          setAvatar(restored.avatar)
          setColor(restored.color)
        }
      })
      .catch(() => setDatabaseError(true))
  }, [])

  if (route.name === 'kit') return <Showcase />
  if (databaseError) return <main className="grid min-h-full place-items-center bg-chrome-deep p-6 text-center"><div><h1 className="pixel-heading text-[24px] leading-[24px] text-red-hi">The sketchbook would not open.</h1><p className="mt-3 text-text-muted">Reload the page to try again. Your local data has not been changed.</p></div></main>
  if (!database) return <main className="pixel-heading grid min-h-full place-items-center bg-chrome-deep text-[24px] leading-[24px] text-text">Opening the sketchbook…</main>

  if (!profile || editingProfile) {
    return <OnboardingScreen
      nickname={nickname}
      avatar={avatar}
      color={color}
      restored={Boolean(profile)}
      onNicknameChange={setNickname}
      onAvatarChange={setAvatar}
      onColorChange={setColor}
      onContinue={() => {
        const next = { id: profile?.id ?? crypto.randomUUID(), nickname: nickname.trim(), avatar, color }
        void database.players.save(next).then(() => {
          setProfile(next)
          setEditingProfile(false)
        })
      }}
    />
  }

  if (route.name === 'room') return <RoomView roomId={route.roomId} profile={profile} database={database} onLeave={() => navigate()} />
  if (route.name === 'practice') return <PracticeRoute database={database} onExit={() => navigate()} />
  if (route.name === 'stats') return <StatsRoute database={database} profile={profile} onBack={() => navigate()} />

  return <HomeScreen
    profile={profile}
    roomCode={roomCode}
    onRoomCodeChange={setRoomCode}
    onCreateRoom={() => {
      const room = createRoom()
      room.transport.leave()
      navigate(`room=${room.transport.roomId}`)
    }}
    onJoinRoom={() => navigate(`room=${normalizeRoomCode(roomCode)}`)}
    onPractice={() => navigate('practice')}
    onStats={() => navigate('stats')}
    onEditProfile={() => setEditingProfile(true)}
  />
}
