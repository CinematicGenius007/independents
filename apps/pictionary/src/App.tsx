import { useEffect, useState } from 'react'
import { Showcase } from './design/Showcase'

/**
 * Hash router shell.
 *
 * Routes are intentionally minimal — the whole game lives at `#` (with an
 * optional `#room=CODE` deep link) and `#kit` renders the design-system
 * showcase during development. Screens are mounted here by the screens agent.
 */
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

export function App() {
  const route = useRoute()

  if (route.name === 'kit') {
    return <Showcase />
  }

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <p className="font-[family-name:var(--font-display)] text-2xl">
        Scribble Club — {route.name} route. Screens land in P6.
      </p>
    </main>
  )
}
