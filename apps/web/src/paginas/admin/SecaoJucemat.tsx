import type { ResultadoJucemat } from '@eloconnect/shared';
import { ApiError, exemploXmlJucemat } from '@eloconnect/shared';
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
} from '../../componentes';

/**
 * Importação do arquivo da JUCEMAT (RF28). Diferente da planilha, não é
 * tudo ou nada: as farmácias novas entram sem o boleto mensal, as que já
 * estão só ganham os dados que faltam, e a empresa com problema fica de fora.
 */
export function SecaoJucemat() {
  const [erroArquivo, setErroArquivo] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoJucemat | null>(null);

  async function importar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const arquivo = evento.currentTarget.querySelector<HTMLInputElement>(
      'input[name="arquivo"]',
    )?.files?.[0];
    if (!arquivo) {
      setErroArquivo('Escolha o arquivo da JUCEMAT.');
      return;
    }
    setErroArquivo(undefined);
    setErro(null);
    setResultado(null);
    setEnviando(true);
    try {
      setResultado(await api.importarJucemat(arquivo));
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
    <section className="mt-5" aria-labelledby="titulo-jucemat">
      <h2 id="titulo-jucemat">Arquivo da JUCEMAT</h2>
      <p>
        Envie o arquivo XML da JUCEMAT com as farmácias de Mato Grosso. As
        farmácias novas entram no cadastro sem receber o boleto mensal. As que
        já estão no cadastro só ganham os dados que faltam: o que a sede digitou
        não muda.
      </p>
      <p>
        <Botao
          variant="outline-primary"
          onClick={() =>
            baixarArquivo(
              new Blob([exemploXmlJucemat()], {
                type: 'application/xml;charset=utf-8',
              }),
              'exemplo-jucemat.xml',
            )
          }
        >
          Baixar um exemplo do arquivo
        </Botao>
      </p>

      {resultado &&
        (resultado.novas > 0 ||
          resultado.completadas > 0 ||
          resultado.semMudanca > 0) && (
          <AvisoSucesso>
            {resultado.novas === 1
              ? '1 farmácia nova.'
              : `${resultado.novas} farmácias novas.`}{' '}
            {resultado.completadas === 1
              ? '1 cadastro completado.'
              : `${resultado.completadas} cadastros completados.`}{' '}
            {resultado.semMudanca === 1
              ? '1 já estava completo.'
              : `${resultado.semMudanca} já estavam completos.`}{' '}
            <Link to="/admin/associados">Ver a lista de associados</Link>
          </AvisoSucesso>
        )}
      {resultado && resultado.erros.length > 0 && (
        <MensagemErro>
          {resultado.erros.length === 1
            ? '1 empresa ficou de fora:'
            : `${resultado.erros.length} empresas ficaram de fora:`}
          <ul className="mb-0 mt-2">
            {resultado.erros.map(({ empresa, mensagem }) => (
              <li key={empresa}>
                {empresa > 0 ? `Empresa ${empresa}: ` : ''}
                {mensagem}
              </li>
            ))}
          </ul>
        </MensagemErro>
      )}
      {erro && <MensagemErro>{erro}</MensagemErro>}

      <Form noValidate onSubmit={(evento) => void importar(evento)}>
        <CampoTexto
          rotulo="Arquivo da JUCEMAT (XML)"
          name="arquivo"
          type="file"
          accept=".xml,application/xml,text/xml"
          obrigatorio
          erro={erroArquivo}
        />
        <Botao type="submit" disabled={enviando}>
          {enviando ? 'Importando...' : 'Importar o arquivo'}
        </Botao>
      </Form>
    </section>
  );
}
