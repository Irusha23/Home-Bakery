/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STARTER_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
