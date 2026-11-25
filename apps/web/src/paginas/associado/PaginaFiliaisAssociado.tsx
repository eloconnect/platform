import type { Filial } from '@eloconnect/shared';
import { formatarCnpj } from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import { api } from '../../api';
import {
  Carregando,
  EtiquetaSituacao,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';
import { CartaoBoleto } from './PaginaBoletosAssociado';

type Estado = Filial[] | 'carregando' | 'erro';

/**
 * Filiais da matriz (RF43, RN31): a situação de cada filial e os boletos em
 * aberto, para a matriz pagar com Pix ou com o boleto. A contribuição
 * continua por CNPJ.
 */
export function PaginaFiliaisAssociado() {
  useTituloPagina('Filiais');
  const [estado, setEstado] = useState<Estado>('carregando');

  useEffect(() => {
    let ativo = true;
    void api
      .listarFiliais()
      .then((lista) => ativo && setEstado(lista))
      .catch(() => ativo && setEstado('erro'));
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <>
      <h1>Filiais</h1>
      <p className="lead">
        Cada filial paga a própria contribuição. Daqui, a matriz acompanha e
        paga os boletos delas.
      </p>
      {estado === 'carregando' && (
        <Carregando texto="Carregando as filiais..." />
      )}
      {estado === 'erro' && (
        <MensagemErro>
          Não foi possível carregar as filiais agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}
      {Array.isArray(estado) && estado.length === 0 && (
        <p>Nenhuma filial no cadastro do sindicato.</p>
      )}
      {Array.isArray(estado) &&
        estado.map((filial) => (
          <section
            key={filial.id}
            className="mb-5"
            aria-labelledby={`filial-${filial.id}`}
          >
            <h2 id={`filial-${filial.id}`}>{filial.nome}</h2>
            <p className="d-flex flex-wrap align-items-center gap-2">
              <span>CNPJ {formatarCnpj(filial.cnpj)}</span>
              <EtiquetaSituacao
                situacao={filial.situacao}
                prefixo="Situação: "
              />
            </p>
            {filial.boletos.length === 0 ? (
              <p>Nenhum boleto em aberto.</p>
            ) : (
              filial.boletos.map((boleto) => (
                <CartaoBoleto
                  key={boleto.id}
                  boleto={boleto}
                  nivelTitulo="h3"
                  baixar={(id) => api.baixarPdfBoletoFilial(filial.id, id)}
                />
              ))
            )}
          </section>
        ))}
    </>
  );
}
