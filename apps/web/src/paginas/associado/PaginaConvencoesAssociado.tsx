import type { Convencao } from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import { api } from '../../api';
import { abrirArquivo } from '../../arquivos';
import { Botao, MensagemErro, useTituloPagina } from '../../componentes';
import { CartaoConvencao } from './CartaoConvencao';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'ok'; convencoes: Convencao[] };

/**
 * Convenções coletivas publicadas pela sede (US22, RF22), das mais novas para
 * as mais antigas. Quem está em dia abre o PDF completo; os demais, o resumo
 * (RN12). A API decide qual dos dois entregar.
 */
export function PaginaConvencoesAssociado() {
  useTituloPagina('Convenções coletivas');
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [abrindo, setAbrindo] = useState<string>();
  const [erroPdf, setErroPdf] = useState(false);

  useEffect(() => {
    let ativo = true;
    void api
      .listarConvencoesAssociado()
      .then((convencoes) => ativo && setEstado({ tipo: 'ok', convencoes }))
      .catch(() => ativo && setEstado({ tipo: 'erro' }));
    return () => {
      ativo = false;
    };
  }, []);

  async function abrirPdf(convencao: Convencao) {
    setAbrindo(convencao.id);
    setErroPdf(false);
    try {
      abrirArquivo(
        await api.baixarPdfConvencaoAssociado(convencao.id),
        'convencao.pdf',
      );
    } catch {
      setErroPdf(true);
    } finally {
      setAbrindo(undefined);
    }
  }

  return (
    <>
      <h1>Convenções coletivas</h1>
      <p>
        Quem está com a contribuição em dia abre a convenção completa. Os demais
        abrem o resumo.
      </p>

      {erroPdf && (
        <MensagemErro>
          Não foi possível abrir o PDF agora. Tente de novo em alguns minutos.
        </MensagemErro>
      )}
      {estado.tipo === 'carregando' && (
        <p role="status">Carregando as convenções...</p>
      )}
      {estado.tipo === 'erro' && (
        <MensagemErro>
          Não foi possível carregar as convenções agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}
      {estado.tipo === 'ok' && estado.convencoes.length === 0 && (
        <p>Ainda não há convenções publicadas.</p>
      )}
      {estado.tipo === 'ok' &&
        estado.convencoes.map((convencao) => (
          <CartaoConvencao
            key={convencao.id}
            titulo={convencao.titulo}
            ano={convencao.ano}
            resumo={convencao.resumo}
          >
            {convencao.anexos.length > 0 ? (
              <Botao
                disabled={abrindo === convencao.id}
                aria-label={`Abrir o PDF: ${convencao.titulo}`}
                onClick={() => void abrirPdf(convencao)}
              >
                Abrir o PDF
              </Botao>
            ) : (
              <p className="mb-0">
                O PDF desta convenção ainda não está disponível.
              </p>
            )}
          </CartaoConvencao>
        ))}
    </>
  );
}
