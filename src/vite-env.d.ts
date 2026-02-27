/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KIE_API_KEY: string;
  readonly GEMINI_API_KEY: string;
  readonly VITE_APP_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
