/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** E-mail para pedir o cadastro da farmácia (RF01). Depende da P19. */
  readonly VITE_EMAIL_PEDIDO_CADASTRO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
