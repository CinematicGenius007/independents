import type { Env as RoomsEnv } from '../src/env'

declare global {
  namespace Cloudflare {
    interface Env extends RoomsEnv {}
    interface GlobalProps {
      mainModule: typeof import('../src/index')
      durableNamespaces: 'Room'
    }
  }
}
