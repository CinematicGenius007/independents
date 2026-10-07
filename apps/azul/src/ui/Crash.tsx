/**
 * The last line of defence.
 *
 * A render error anywhere below this would otherwise leave a blank page in the
 * middle of someone's game. The position itself lives with the other players
 * — a reload rejoins the room by its link and is handed the board back — so
 * the honest thing to offer is exactly that.
 */

import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface State {
  error: Error | null
}

export class Crash extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Azulejo crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="app">
        <section className="choice" role="alert">
          <h2>The table fell over</h2>
          <p>
            Something on this page broke. If you were in a room, reloading puts you back at the
            same table with the board as everyone else sees it.
          </p>
          <div className="row">
            <button type="button" className="button button--gold" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        </section>
      </div>
    )
  }
}
