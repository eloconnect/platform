import type { ReactNode } from 'react';

function Icone({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconePainel = () => (
  <Icone>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </Icone>
);

export const IconeValores = () => (
  <Icone>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6.5 9.5v5M17.5 9.5v5" />
  </Icone>
);

export const IconePerfil = () => (
  <Icone>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
  </Icone>
);

export const IconeConvencoes = () => (
  <Icone>
    <path d="m14 4 6 6-3 3-6-6zM4 20l5-5M11 7 6 12l6 6 5-5" />
  </Icone>
);

export const IconeJucemat = () => (
  <Icone>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4M9 12h6M9 16h6" />
  </Icone>
);

export const IconeRaio = () => (
  <Icone>
    <path d="M13 3 5 13h6l-1 8 8-10h-6z" />
  </Icone>
);

export const IconeMais = () => (
  <Icone>
    <path d="M4 7h10M4 12h6M4 17h10" />
    <path d="M18 9v6M15 12h6" />
  </Icone>
);

export const IconeCalendario = () => (
  <Icone>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </Icone>
);

export const IconeEscudo = () => (
  <Icone>
    <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Icone>
);

export const IconeCarteira = () => (
  <Icone>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18M16 14.5h2" />
  </Icone>
);

export const IconeBanco = () => (
  <Icone>
    <path d="M3 9 12 4l9 5M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18" />
  </Icone>
);

export const IconeLupa = () => (
  <Icone>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Icone>
);

export const IconePredio = () => (
  <Icone>
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4h4v4" />
  </Icone>
);

export const IconeFarmacia = () => (
  <Icone>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M12 8v6M9 11h6" />
  </Icone>
);

export const IconeProibido = () => (
  <Icone>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m6 6 12 12" />
  </Icone>
);

export const IconeOlho = () => (
  <Icone>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </Icone>
);

export const IconeUpload = () => (
  <Icone>
    <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 9.5" />
    <path d="m12 11-3 3m3-3 3 3m-3-3v9" />
  </Icone>
);

export const IconeDocumento = () => (
  <Icone>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4" />
  </Icone>
);
