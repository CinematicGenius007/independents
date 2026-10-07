/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the independents rooms service. Unset = peer-to-peer fallback. */
  readonly VITE_ROOMS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
