import type { Convencao } from '@eloconnect/shared';
import { useState } from 'react';
import { api } from '../../api';
import { baixarArquivo } from '../../arquivos';
import { Botao, MensagemErro } from '../../componentes';

/**
 * Inscrição da farmácia na convenção (US23: RF23, P05). Quem está em dia se
 * inscreve com um clique e baixa o comprovante em PDF.
 */
export function InscricaoConvencao({ convencao }: { convencao: Convencao }) {
  const [inscritaEm, setInscritaEm] = useState(convencao.inscritaEm);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function inscrever() {
    setEnviando(true);
    setErro(null);
    try {
      setInscritaEm((await api.inscreverNaConvencao(convencao.id)).inscritaEm);
    } catch {
      setErro('Não foi possível fazer a inscrição agora. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  async function baixar() {
    setEnviando(true);
    setErro(null);
    try {
      baixarArquivo(
        await api.baixarComprovanteInscricao(convencao.id),
        'comprovante-inscricao.pdf',
      );
    } catch {
      setErro('Não foi possível baixar o comprovante agora. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-3">
      {inscritaEm ? (
        <>
          <p className="fw-bold">
            Farmácia inscrita em{' '}
            {new Date(inscritaEm).toLocaleDateString('pt-BR')}.
          </p>
          <Botao
            variant="outline-primary"
            disabled={enviando}
            aria-label={`Baixar o comprovante de inscrição: ${convencao.titulo}`}
            onClick={() => void baixar()}
          >
            Baixar o comprovante
          </Botao>
        </>
      ) : convencao.inscricaoPermitida ? (
        <>
          <p>
            Inscreva a farmácia nesta convenção e baixe o comprovante, para
            mostrar quando precisar.
          </p>
          <Botao
            variant="outline-primary"
            disabled={enviando}
            aria-label={`Inscrever minha farmácia: ${convencao.titulo}`}
            onClick={() => void inscrever()}
          >
            Inscrever minha farmácia
          </Botao>
        </>
      ) : (
        <p>
          A inscrição na convenção é para quem está com a contribuição em dia.
        </p>
      )}
      {erro && <MensagemErro>{erro}</MensagemErro>}
    </div>
  );
}
