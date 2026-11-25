/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STARTER_MODE?: string
  readonly VITE_UPDATE_FEED_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
