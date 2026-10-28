import type { MinhaConta } from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import { api } from '../../api';
import { MensagemErro, useTituloPagina } from '../../componentes';

/**
 * Início da área do associado: a situação dele e, quando a sede liberou o
 * acesso, o aviso com a data de fim da liberação (RN11, RN22).
 */
export function PaginaInicioAssociado() {
  useTituloPagina('Área do associado');
  const [conta, setConta] = useState<MinhaConta | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    void api
      .minhaConta()
      .then((resposta) => ativo && setConta(resposta))
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <>
      <h1>Área do associado</h1>
      {erro && (
        <MensagemErro>
          Não foi possível carregar os seus dados agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}
      {!erro && !conta && <p role="status">Carregando...</p>}
      {conta && (
        <>
          <p className="lead">{conta.nome}</p>
          <p>Situação: {conta.situacao}</p>
          {conta.acessoLiberadoAte && (
            <Alert variant="warning">
              <Alert.Heading as="h2" className="h5">
                Acesso liberado pela sede até{' '}
                {new Date(conta.acessoLiberadoAte).toLocaleDateString('pt-BR')}
              </Alert.Heading>
              <p className="mb-0">
                A sede liberou o seu acesso a benefícios e suporte até essa
                data. Depois dela, o acesso volta a depender do pagamento em
                dia.
              </p>
            </Alert>
          )}
        </>
      )}
    </>
  );
}
