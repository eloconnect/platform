import type { ReactNode } from 'react';
import Alert from 'react-bootstrap/Alert';

/** Mensagem de erro anunciada na hora pelos leitores de tela (role="alert"). */
export function MensagemErro({
  titulo,
  children,
}: {
  titulo?: string;
  children: ReactNode;
}) {
  return (
    <Alert variant="danger" role="alert">
      {titulo && (
        <Alert.Heading as="h2" className="h5">
          {titulo}
        </Alert.Heading>
      )}
      {children}
    </Alert>
  );
}
