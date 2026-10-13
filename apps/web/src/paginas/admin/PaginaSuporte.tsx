import { useState } from 'react';
import type { StatusSolicitacaoSuporte } from '@eloconnect/shared';
import { api } from '../../api';
import { useTituloPagina } from '../../componentes';
import { AvisoCarga, CabecalhoAdmin, TopoAdmin } from './ComponentesAdmin';
import { data, executarAdmin, useDadosAdmin } from './useDadosAdmin';

const STATUS: Record<StatusSolicitacaoSuporte, string> = {
  RECEBIDA: 'Recebida',
  EM_ANALISE: 'Em análise',
  CONCLUIDA: 'Concluída',
};

function ehStatusSolicitacao(valor: string): valor is StatusSolicitacaoSuporte {
  return Object.hasOwn(STATUS, valor);
}

export function PaginaSuporte() {
  useTituloPagina('Solicitações de suporte');
  const {
    dados: lista,
    definir: definirLista,
    erro,
    carregando,
  } = useDadosAdmin((token) => api.admin.solicitacoesSuporte(token), []);
  const [atualizando, setAtualizando] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function alterarStatus(id: string, status: StatusSolicitacaoSuporte) {
    setAtualizando(id);
    setMensagem(null);
    const resultado = await executarAdmin((token) =>
      api.admin.atualizarStatusSuporte(token, id, status),
    );
    if (!resultado.dados) {
      setMensagem(
        resultado.erro ?? 'Não foi possível atualizar a solicitação.',
      );
      setAtualizando(null);
      return;
    }
    const recarga = await executarAdmin((token) =>
      api.admin.solicitacoesSuporte(token),
    );
    if (recarga.dados) definirLista(recarga.dados);
    setMensagem(
      recarga.erro
        ? 'Status atualizado, mas não foi possível recarregar a lista.'
        : 'Status da solicitação atualizado.',
    );
    setAtualizando(null);
  }

  return (
    <>
      <TopoAdmin />
      <CabecalhoAdmin
        titulo="Solicitações de suporte"
        descricao="Acompanhe os pedidos de suporte jurídico particular enviados por afiliados."
      />
      <section className="adm-cartao adm-bloco" aria-labelledby="t-suporte">
        <h2 id="t-suporte" className="adm-bloco-titulo">
          Pedidos recebidos
        </h2>
        <AvisoCarga carregando={carregando} erro={erro} />
        {mensagem && (
          <p className="adm-mensagem" role="status">
            {mensagem}
          </p>
        )}
        <ul className="adm-lista-itens">
          {lista?.map((solicitacao) => (
            <li
              className="adm-item-convencao adm-solicitacao-suporte"
              key={solicitacao.id}
            >
              <div>
                <strong>{solicitacao.associado}</strong>
                <small>
                  CNPJ {solicitacao.cnpj} • Recebida em{' '}
                  {data(solicitacao.criadaEm)}
                </small>
                <p>{solicitacao.mensagem}</p>
                <label>
                  <span>Status</span>
                  <select
                    value={solicitacao.status}
                    disabled={atualizando === solicitacao.id}
                    onChange={(evento) => {
                      const status = evento.currentTarget.value;
                      if (ehStatusSolicitacao(status)) {
                        void alterarStatus(solicitacao.id, status);
                      } else {
                        setMensagem('Status de solicitação inválido.');
                      }
                    }}
                  >
                    {Object.entries(STATUS).map(([valor, rotulo]) => (
                      <option key={valor} value={valor}>
                        {rotulo}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </li>
          ))}
          {lista?.length === 0 && (
            <li className="adm-sem-resultado">
              Nenhuma solicitação de suporte recebida.
            </li>
          )}
        </ul>
      </section>
    </>
  );
}
