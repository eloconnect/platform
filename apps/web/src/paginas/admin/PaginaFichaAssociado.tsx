import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useTituloPagina } from '../../componentes';
import { api } from '../../api';
import { AvisoCarga, CabecalhoAdmin, TopoAdmin } from './ComponentesAdmin';
import {
  IconeCarteira,
  IconeEscudo,
  IconeProibido,
  IconePredio,
} from './icones';
import {
  cnpjMascarado,
  data,
  executarAdmin,
  moeda,
  useDadosAdmin,
} from './useDadosAdmin';

const SITUACAO = {
  EM_DIA: 'Adimplente',
  PENDENTE: 'Inadimplente',
  INADIMPLENTE: 'Inadimplente',
} as const;

const STATUS_BOLETO: Record<string, string> = {
  PAGO: 'Quitado',
  EM_ABERTO: 'Em aberto',
  VENCIDO: 'Vencido',
  CANCELADO: 'Cancelado',
  RASCUNHO: 'Rascunho',
};

function mesAno(iso: string) {
  const texto = new Date(iso).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1).replace(' de ', '/');
}

/** Ficha cadastral e financeira de um associado. */
export function PaginaFichaAssociado() {
  useTituloPagina('Ficha do associado');
  const { id = '' } = useParams();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const {
    dados: f,
    erro,
    carregando,
    definir,
  } = useDadosAdmin((token) => api.admin.ficha(token, id), [id]);

  return (
    <>
      <TopoAdmin />
      <nav className="adm-migalhas" aria-label="Você está em">
        <Link to="/admin">Sede Central</Link>
        <span aria-hidden="true">›</span>
        <span>Associados</span>
        {f && (
          <>
            <span aria-hidden="true">›</span>
            <strong>{f.nomeFantasia ?? f.razaoSocial}</strong>
          </>
        )}
      </nav>
      <CabecalhoAdmin titulo="Ficha Cadastral e Financeira do Associado" />
      <AvisoCarga carregando={carregando} erro={erro} />
      {mensagem && (
        <p className="adm-aviso" role="status">
          {mensagem}
        </p>
      )}

      {f && (
        <>
          <section className="adm-cartao adm-ficha-topo">
            <span
              className="adm-icone-linha adm-icone-grande"
              aria-hidden="true"
            >
              <IconePredio />
            </span>
            <div className="adm-ficha-identidade">
              <h2>{f.nomeFantasia ?? f.razaoSocial}</h2>
              <span
                className={`adm-situacao adm-situacao-${f.situacao.toLowerCase()}`}
              >
                <span aria-hidden="true" className="adm-ponto" />
                {SITUACAO[f.situacao]}
              </span>
              <p>
                <strong>CNPJ:</strong> {cnpjMascarado(f.cnpj)}
                {f.municipio && <> • {f.municipio}/MT</>} • Cadastro:{' '}
                {data(f.filiadoDesde)}
              </p>
            </div>
            <button
              type="button"
              className="adm-botao-perigo"
              onClick={async () => {
                const r = await executarAdmin((t) =>
                  api.admin.definirAcesso(t, f.id, !f.bloqueado),
                );
                if (r.dados) definir(r.dados);
                setMensagem(
                  r.erro ??
                    (r.dados?.bloqueado
                      ? 'Acesso bloqueado.'
                      : 'Acesso liberado.'),
                );
              }}
            >
              <IconeProibido />
              {f.bloqueado
                ? 'Liberar acesso a benefícios'
                : 'Bloquear acesso a benefícios'}
            </button>
          </section>

          <section
            className="adm-cartao adm-bloco"
            aria-labelledby="t-cadastro"
          >
            <h2 id="t-cadastro" className="adm-bloco-titulo">
              <IconeEscudo />
              Ficha Cadastral Essencial
            </h2>
            <div className="adm-grade-dados">
              <div className="adm-dado">
                <small>RAZÃO SOCIAL</small>
                <strong>{f.razaoSocial}</strong>
                <span>Fantasia: {f.nomeFantasia ?? '—'}</span>
              </div>
              <div className="adm-dado">
                <small>LOCALIZAÇÃO</small>
                <strong>{f.municipio ? `${f.municipio} / MT` : '—'}</strong>
                <span>CNPJ {cnpjMascarado(f.cnpj)}</span>
              </div>
              <div className="adm-dado">
                <small>E-MAIL DE CONTATO</small>
                <strong>{f.email ?? '—'}</strong>
              </div>
              <div className="adm-dado">
                <small>TELEFONE / WHATSAPP</small>
                <strong>{f.telefone ?? '—'}</strong>
              </div>
            </div>
          </section>

          <section className="adm-cartao adm-bloco" aria-labelledby="t-fin">
            <h2 id="t-fin" className="adm-bloco-titulo">
              <IconeCarteira />
              Boletos e pagamentos
            </h2>
            <div className="adm-tabela-rolagem">
              <table className="adm-tabela adm-tabela-simples">
                <thead>
                  <tr>
                    <th scope="col">Competência</th>
                    <th scope="col">Vencimento</th>
                    <th scope="col">Valor</th>
                    <th scope="col" className="adm-coluna-acao">
                      Situação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {f.boletos.map((b) => (
                    <tr key={b.id}>
                      <td>{mesAno(b.competencia)}</td>
                      <td>{data(b.vencimento)}</td>
                      <td className="adm-valor">{moeda(b.valor)}</td>
                      <td className="adm-coluna-acao">
                        <span
                          className={`adm-situacao ${
                            b.status === 'PAGO'
                              ? 'adm-situacao-em_dia'
                              : 'adm-situacao-pendente'
                          }`}
                        >
                          {STATUS_BOLETO[b.status] ?? b.status}
                          {b.pagoEm && ` (${data(b.pagoEm).slice(0, 5)})`}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {f.boletos.length === 0 && (
                    <tr>
                      <td colSpan={4} className="adm-sem-resultado">
                        Nenhum lançamento para este associado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
