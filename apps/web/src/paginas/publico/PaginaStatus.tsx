import type { HealthResponse } from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import { api } from '../../api';
import { AvisoSucesso, MensagemErro, useTituloPagina } from '../../componentes';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'ok'; dados: HealthResponse }
  | { tipo: 'erro' };

/** Página de teste do ambiente: confere se a API e o banco respondem. */
export function PaginaStatus() {
  useTituloPagina('Status do sistema');
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });

  useEffect(() => {
    let ativo = true;
    void api
      .getHealth()
      .then((dados) => ativo && setEstado({ tipo: 'ok', dados }))
      .catch(() => ativo && setEstado({ tipo: 'erro' }));
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <>
      <h1>Status do sistema</h1>
      {estado.tipo === 'carregando' && (
        <p role="status">Verificando a API...</p>
      )}
      {estado.tipo === 'erro' && (
        <MensagemErro titulo="A API não respondeu">
          Confira se a API está rodando (<code>pnpm dev</code> na raiz do
          projeto).
        </MensagemErro>
      )}
      {estado.tipo === 'ok' && estado.dados.database === 'ok' && (
        <AvisoSucesso titulo="Tudo funcionando">
          A API e o banco de dados estão respondendo.
        </AvisoSucesso>
      )}
      {estado.tipo === 'ok' && estado.dados.database === 'erro' && (
        <MensagemErro titulo="O banco de dados não respondeu">
          A API está rodando, mas não conectou ao banco. Confira se o Docker
          está ligado (<code>docker compose up -d</code>).
        </MensagemErro>
      )}
    </>
  );
}
