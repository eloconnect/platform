import type { ResultadoImportacao } from '@eloconnect/shared';
import {
  ApiError,
  COLUNAS_IMPORTACAO,
  planilhaModelo,
} from '@eloconnect/shared';
import { useState, type FormEvent } from 'react';
import Form from 'react-bootstrap/Form';
import { Link } from 'react-router';
import { api } from '../../api';
import { baixarArquivo } from '../../arquivos';
import {
  AvisoSucesso,
  Botao,
  CampoTexto,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';

/**
 * Carga inicial dos associados que já pagam (RF42, O7): a sede baixa a
 * planilha modelo, preenche no Excel e envia aqui. Com qualquer erro, nada
 * entra, e a página mostra as linhas para corrigir.
 */
export function PaginaImportarAssociados() {
  useTituloPagina('Importar associados');
  const [erroArquivo, setErroArquivo] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);

  async function importar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const arquivo = evento.currentTarget.querySelector<HTMLInputElement>(
      'input[name="planilha"]',
    )?.files?.[0];
    if (!arquivo) {
      setErroArquivo('Escolha a planilha.');
      return;
    }
    setErroArquivo(undefined);
    setErro(null);
    setResultado(null);
    setEnviando(true);
    try {
      setResultado(await api.importarAssociados(arquivo));
    } catch (e) {
      setErro(
        e instanceof ApiError && e.status < 500
          ? e.message
          : 'Não foi possível importar agora. Tente de novo em alguns minutos.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Link to="/admin/associados" className="elo-link-solto">
        Voltar para a lista de associados
      </Link>
      <h1 className="mt-3">Importar associados</h1>
      <p>
        Para cadastrar de uma vez as farmácias, principalmente as que já pagam a
        contribuição, preencha a planilha modelo e envie aqui.
      </p>
      <ol>
        <li className="mb-2">
          Baixe a planilha modelo e abra no Excel.
          <div className="mt-2">
            <Botao
              variant="outline-primary"
              onClick={() =>
                baixarArquivo(
                  new Blob([planilhaModelo()], {
                    type: 'text/csv;charset=utf-8',
                  }),
                  'planilha-modelo-associados.csv',
                )
              }
            >
              Baixar a planilha modelo
            </Botao>
          </div>
        </li>
        <li className="mb-2">
          Preencha uma linha por farmácia, nas colunas{' '}
          {COLUNAS_IMPORTACAO.join(', ')}. O CNPJ e a razão social são
          obrigatórios.
        </li>
        <li className="mb-2">
          Em "Recebe boleto mensal", escreva <strong>sim</strong> para quem já
          paga todo mês e <strong>não</strong> para as demais. Quem recebe o
          boleto entra como em dia.
        </li>
        <li className="mb-2">Salve como CSV e envie abaixo.</li>
      </ol>

      {resultado && resultado.erros.length === 0 && (
        <AvisoSucesso>
          {resultado.importados === 1
            ? '1 associado importado.'
            : `${resultado.importados} associados importados.`}{' '}
          {resultado.recebemBoleto === 1
            ? '1 recebe o boleto mensal.'
            : `${resultado.recebemBoleto} recebem o boleto mensal.`}{' '}
          <Link to="/admin/associados">Ver a lista de associados</Link>
        </AvisoSucesso>
      )}
      {resultado && resultado.erros.length > 0 && (
        <MensagemErro>
          A planilha tem erros, e nada foi importado. Corrija as linhas abaixo e
          envie de novo.
          <ul className="mb-0 mt-2">
            {resultado.erros.map(({ linha, mensagem }) => (
              <li key={linha}>
                Linha {linha}: {mensagem}
              </li>
            ))}
          </ul>
        </MensagemErro>
      )}
      {erro && <MensagemErro>{erro}</MensagemErro>}

      <Form noValidate onSubmit={(evento) => void importar(evento)}>
        <CampoTexto
          rotulo="Planilha (CSV)"
          name="planilha"
          type="file"
          accept=".csv,text/csv"
          obrigatorio
          erro={erroArquivo}
        />
        <Botao type="submit" disabled={enviando}>
          {enviando ? 'Importando...' : 'Importar'}
        </Botao>
      </Form>
    </>
  );
}
