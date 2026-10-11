import type { ReactNode } from 'react';
import Alert from 'react-bootstrap/Alert';

/** Aviso de sucesso anunciado pelos leitores de tela (role="status"). */
export function AvisoSucesso({
  titulo,
  children,
}: {
  titulo?: string;
  children: ReactNode;
}) {
  return (
    <Alert variant="success" role="status">
      {titulo && (
        <Alert.Heading as="h2" className="h5">
          {titulo}
        </Alert.Heading>
      )}
      {children}
    </Alert>
  );
}
