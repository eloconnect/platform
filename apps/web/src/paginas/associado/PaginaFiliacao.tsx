import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api';
import { useTituloPagina } from '../../componentes';
import { AvisoCarga } from '../admin/ComponentesAdmin';
import { executarAdmin, useDadosAdmin } from '../admin/useDadosAdmin';

const PERDAS = [
  {
    titulo:
      'Perda da Assessoria Jurídica Trabalhista gratuita em dissídios e processos;',
    texto:
      'Sua empresa passará a arcar integralmente com honorários advocatícios particulares em defesas, notificações e acordos com empregados.',
  },
  {
    titulo:
      'Suspensão imediata dos descontos em distribuidores de medicamentos;',
    texto:
      'Cancelamento dos acordos comerciais exclusivos firmados com os maiores atacadistas e laboratórios farmacêuticos parceiros.',
  },
  {
    titulo:
      'Bloqueio na emissão da Certidão Negativa Sindical (CND), exigida em licitações e convênios;',
    texto:
      'Inviabilidade de participação em editais municipais/estaduais e impedimento na renovação de parcerias com planos de saúde e PBMs.',
  },
  {
    titulo: 'Notificação automática de alteração de situação cadastral.',
    texto:
      'Comunicação aos conselhos regionais e órgãos fiscalizadores sobre o encerramento do vínculo institucional ativo.',
  },
];

/** Pedido de cancelamento da filiação, com resumo do que se perde. */
export function PaginaFiliacao() {
  useTituloPagina('Gestão de Filiação');
  const [ciente, setCiente] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const {
    dados: p,
    erro,
    carregando,
    definir,
  } = useDadosAdmin((token) => api.associado.painel(token), []);

  async function confirmar() {
    const r = await executarAdmin((t) =>
      api.associado.solicitarCancelamento(t),
    );
    if (r.dados) definir(r.dados);
    setMensagem(
      r.erro ??
        'Pedido enviado. A sede vai analisar e confirmar o encerramento.',
    );
  }

  return (
    <>
      <nav className="as-migalhas" aria-label="Você está em">
        <Link to="/associado/convencoes">‹ Voltar ao Painel Principal</Link>
        <span>Gestão de Filiação Sindical</span>
      </nav>
      <section className="as-cartao as-atencao">
        <p className="as-selo as-alerta">ATENÇÃO FARMACÊUTICO RESPONSÁVEL</p>
        <h1>Solicitação de Cancelamento da Filiação</h1>
        <p className="as-descricao">
          Antes de prosseguir, veja com clareza os serviços e coberturas que
          serão suspensos para sua farmácia.
        </p>
      </section>
      <AvisoCarga carregando={carregando} erro={erro} />
      {mensagem && (
        <p className="as-aviso" role="status">
          {mensagem}
        </p>
      )}

      <section className="as-cartao" aria-labelledby="t-resumo">
        <h2 id="t-resumo">
          Resumo dos benefícios sindicais suspensos de imediato:
        </h2>
        <ul className="as-perdas">
          {PERDAS.map((perda) => (
            <li key={perda.titulo}>
              <strong>{perda.titulo}</strong>
              <span>{perda.texto}</span>
            </li>
          ))}
        </ul>
      </section>

      <Link to="/associado" className="as-botao as-botao-largo">
        Manter minha filiação e continuar protegido
      </Link>

      <section className="as-cartao as-confirmacao">
        {p?.cancelamentoPendente ? (
          <p role="status">
            <strong>Pedido em análise.</strong> A sede já recebeu sua
            solicitação de cancelamento.
          </p>
        ) : (
          <>
            <p>
              Caso sua decisão seja definitiva, selecione abaixo para habilitar
              o encerramento:
            </p>
            <label className="as-checagem">
              <input
                type="checkbox"
                checked={ciente}
                onChange={(e) => setCiente(e.target.checked)}
              />
              <span>
                Estou ciente da perda imediata da proteção jurídica e dos
                descontos comerciais da farmácia.
              </span>
            </label>
            <button
              type="button"
              className="as-botao as-botao-claro as-botao-largo"
              disabled={!ciente || !p}
              onClick={() => void confirmar()}
            >
              Confirmar Pedido de Cancelamento
            </button>
          </>
        )}
      </section>
    </>
  );
}
