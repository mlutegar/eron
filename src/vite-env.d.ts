/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_LOGIN_USER?: string;
  readonly VITE_LOGIN_PASS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
