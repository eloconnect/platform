import type {
  Convencao,
  MinhaConta,
  TipoAnexoConvencao,
} from '@eloconnect/shared';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { MensagemErro, useTituloPagina } from '../../componentes';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | {
      tipo: 'ok';
      convencoes: Convencao[];
      conta: MinhaConta;
    };

/**
 * Consulta de convenções pelo associado.
 * Todos os associados ativos podem consultar as informações gerais e o PDF
 * resumido. O PDF integral exige situação adimplente e contribuição ativa.
 */
export function PaginaConvencoesAssociado() {
  useTituloPagina('Convenções');

  const [estado, setEstado] = useState<Estado>({
    tipo: 'carregando',
  });
  const [baixando, setBaixando] = useState<string | null>(null);
  const [erroDownload, setErroDownload] = useState(false);

  const buscarDados = useCallback(async () => {
    const [convencoes, conta] = await Promise.all([
      api.listarConvencoesAssociado(),
      api.minhaConta(),
    ]);

    return {
      tipo: 'ok' as const,
      convencoes: convencoes.filter(
        (convencao) => convencao.publicadaEm !== null,
      ),
      conta,
    };
  }, []);

  const carregar = useCallback(async () => {
    setEstado({ tipo: 'carregando' });

    try {
      setEstado(await buscarDados());
    } catch {
      setEstado({ tipo: 'erro' });
    }
  }, [buscarDados]);

  useEffect(() => {
    let ativo = true;

    async function executar() {
      try {
        const resultado = await buscarDados();

        if (ativo) {
          setEstado(resultado);
        }
      } catch {
        if (ativo) {
          setEstado({ tipo: 'erro' });
        }
      }
    }

    void executar();

    return () => {
      ativo = false;
    };
  }, [buscarDados]);

  const baixarAnexo = useCallback(
    async (convencao: Convencao, tipo: TipoAnexoConvencao) => {
      const chave = `${convencao.id}-${tipo}`;

      setBaixando(chave);
      setErroDownload(false);

      try {
        const arquivo = await api.baixarAnexoConvencaoAssociado(
          convencao.id,
          tipo,
        );

        const url = URL.createObjectURL(arquivo);
        const novaJanela = window.open(url, '_blank');

        if (!novaJanela) {
          const link = document.createElement('a');
          link.href = url;
          link.download = `${convencao.titulo}-${tipo}.pdf`;
          document.body.appendChild(link);
          link.click();
          link.remove();
        }

        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch {
        setErroDownload(true);
      } finally {
        setBaixando(null);
      }
    },
    [],
  );

  const podeAcessarIntegral =
    estado.tipo === 'ok' &&
    estado.conta.situacaoAcesso === 'ADIMPLENTE' &&
    estado.conta.contribuicaoAtiva;

  return (
    <>
      <h1>Convenções coletivas</h1>

      <p>
        Consulte as informações das convenções coletivas e acesse os documentos
        disponibilizados pelo sindicato.
      </p>

      {estado.tipo === 'carregando' && (
        <p role="status">Carregando as convenções...</p>
      )}

      {estado.tipo === 'erro' && (
        <>
          <MensagemErro>
            Não foi possível carregar as convenções agora. Tente novamente.
          </MensagemErro>
          <button type="button" onClick={() => void carregar()}>
            Tentar novamente
          </button>
        </>
      )}

      {estado.tipo === 'ok' && (
        <>
          {!podeAcessarIntegral && (
            <p>
              Você pode consultar as informações gerais e baixar o PDF resumido.
              O documento integral está disponível para associados adimplentes
              com contribuição ativa.
            </p>
          )}

          {estado.convencoes.length === 0 && (
            <p>Não há convenções publicadas no momento.</p>
          )}

          {estado.convencoes.map((convencao) => {
            const resumo = convencao.anexos.find(
              (anexo) => anexo.tipo === 'RESUMIDA',
            );

            const integral = convencao.anexos.find(
              (anexo) => anexo.tipo === 'INTEGRAL',
            );

            return (
              <article key={convencao.id} className="mb-5">
                <h2 className="h4">{convencao.titulo}</h2>

                <p>
                  <strong>Ano:</strong> {convencao.ano}
                </p>

                <p className="texto-com-quebras">{convencao.resumo}</p>

                {resumo && (
                  <button
                    type="button"
                    disabled={baixando !== null}
                    onClick={() => void baixarAnexo(convencao, 'RESUMIDA')}
                  >
                    {baixando === `${convencao.id}-RESUMIDA`
                      ? 'Carregando PDF...'
                      : 'Baixar PDF resumido'}
                  </button>
                )}

                {podeAcessarIntegral && integral && (
                  <button
                    type="button"
                    className="ms-2"
                    disabled={baixando !== null}
                    onClick={() => void baixarAnexo(convencao, 'INTEGRAL')}
                  >
                    {baixando === `${convencao.id}-INTEGRAL`
                      ? 'Carregando PDF...'
                      : 'Baixar PDF integral'}
                  </button>
                )}

                {!resumo && <p>O PDF resumido ainda não está disponível.</p>}
              </article>
            );
          })}

          {erroDownload && (
            <MensagemErro>
              Não foi possível abrir o documento. Tente novamente.
            </MensagemErro>
          )}
        </>
      )}
    </>
  );
}
