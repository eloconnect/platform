import type { BoletoHistorico } from '@eloconnect/shared';
import {
  formatarDia,
  formatarReais,
  textoMesBoleto,
  textoSituacaoBoleto,
} from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import { api } from '../../api';
import { MensagemErro, useTituloPagina } from '../../componentes';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'ok'; boletos: BoletoHistorico[] };

/**
 * Histórico de boletos e pagamentos do associado (US31: RF31), do mês mais
 * novo para o mais antigo, com a situação em texto claro. Em lista, e não em
 * tabela, para caber na tela do celular sem rolar para o lado (RNF03).
 */
export function PaginaHistoricoAssociado() {
  useTituloPagina('Histórico de pagamentos');
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });

  useEffect(() => {
    let ativo = true;
    void api
      .listarMeuHistorico()
      .then((boletos) => ativo && setEstado({ tipo: 'ok', boletos }))
      .catch(() => ativo && setEstado({ tipo: 'erro' }));
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <>
      <h1>Histórico de pagamentos</h1>
      {estado.tipo === 'carregando' && (
        <p role="status">Carregando os boletos...</p>
      )}
      {estado.tipo === 'erro' && (
        <MensagemErro>
          Não foi possível carregar os boletos agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}
      {estado.tipo === 'ok' && estado.boletos.length === 0 && (
        <p>Nenhum boleto ainda.</p>
      )}
      {estado.tipo === 'ok' && estado.boletos.length > 0 && (
        <ul className="list-unstyled">
          {estado.boletos.map((boleto) => (
            <li key={boleto.id} className="border-bottom py-3">
              <h2 className="h4">Boleto de {textoMesBoleto(boleto)}</h2>
              <p className="mb-1">Valor: {formatarReais(boleto.valor)}</p>
              <p className="mb-1">
                Vencimento: {formatarDia(boleto.vencimento)}
              </p>
              <p className="mb-0">Situação: {textoSituacaoBoleto(boleto)}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
