import type { ReactNode } from 'react';
import Alert from 'react-bootstrap/Alert';
import { Icone } from './Icone';

/** Aviso deixado pela página anterior (ex.: "Dados salvos." depois de editar). */
export function lerAviso(estado: unknown): string | null {
  return typeof estado === 'object' &&
    estado !== null &&
    'aviso' in estado &&
    typeof estado.aviso === 'string'
    ? estado.aviso
    : null;
}

/** Aviso de sucesso anunciado pelos leitores de tela (role="status"). */
export function AvisoSucesso({
  titulo,
  children,
}: {
  titulo?: string;
  children: ReactNode;
}) {
  return (
    <Alert variant="success" role="status" className="elo-aviso">
      <Icone nome="visto" />
      <div>
        {titulo && (
          <Alert.Heading as="h2" className="h5">
            {titulo}
          </Alert.Heading>
        )}
        {children}
      </div>
    </Alert>
  );
}
