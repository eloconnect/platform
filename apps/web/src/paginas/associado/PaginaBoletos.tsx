import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api';
import { useTituloPagina } from '../../componentes';
import { AvisoCarga } from '../admin/ComponentesAdmin';
import {
  data,
  executarAdmin,
  moeda,
  useDadosAdmin,
} from '../admin/useDadosAdmin';
import { Cabecalho, mesAno } from './componentes';

/** Mensalidade em aberto e formas de pagamento. */
export function PaginaBoletos() {
  useTituloPagina('Mensalidade e Boletos');
  const [mensagem, setMensagem] = useState<string | null>(null);
  const {
    dados: p,
    erro,
    carregando,
    definir,
  } = useDadosAdmin((token) => api.associado.painel(token), []);

  async function copiar(texto: string | null | undefined, rotulo: string) {
    if (!texto) {
      setMensagem('Este código ainda não está disponível.');
      return;
    }
    try {
      await navigator.clipboard.writeText(texto);
      setMensagem(`${rotulo} copiado. Cole no aplicativo do seu banco.`);
    } catch {
      setMensagem('Não foi possível copiar. Selecione o código manualmente.');
    }
  }

  async function recorrencia(ativo: boolean) {
    const r = await executarAdmin((t) =>
      api.associado.definirRecorrencia(t, ativo),
    );
    if (r.dados) definir(r.dados);
    setMensagem(
      r.erro ??
        (ativo
          ? 'Envio automático mensal ativado.'
          : 'Envio automático mensal desativado.'),
    );
  }

  const [agora] = useState(() => new Date().setHours(0, 0, 0, 0));
  const boleto = p?.boleto;
  const vencido = !!boleto && new Date(boleto.vencimento).getTime() < agora;

  return (
    <>
      <Cabecalho
        selo="GESTÃO FINANCEIRA SINDICAL"
        titulo="Mensalidade e Boletos da Farmácia"
        lateral={
          p && (
            <p className="as-cadastro">
              <small>CADASTRO ESTABELECIMENTO</small>
              <span>
                <strong>
                  {p.farmacia.nomeFantasia ?? p.farmacia.razaoSocial}
                </strong>{' '}
                • Situação:{' '}
                <em
                  className={
                    p.farmacia.situacao === 'EM_DIA' ? 'as-ok' : 'as-alerta'
                  }
                >
                  {p.farmacia.situacao === 'EM_DIA'
                    ? 'Adimplente'
                    : 'Inadimplente'}
                </em>
              </span>
            </p>
          )
        }
      />
      <AvisoCarga carregando={carregando} erro={erro} />
      {mensagem && (
        <p className="as-aviso" role="status">
          {mensagem}
        </p>
      )}

      {p && (
        <>
          <section
            className="as-cartao as-mensalidade"
            aria-label="Mensalidade atual"
          >
            {boleto ? (
              <>
                <div>
                  <p className="as-etiqueta">
                    Mensalidade de {mesAno(boleto.competencia)}
                  </p>
                  <p className="as-valor">
                    <small>Valor:</small> {moeda(boleto.valor)}
                  </p>
                  <p
                    className={
                      vencido ? 'as-vencimento as-alerta' : 'as-vencimento'
                    }
                  >
                    {vencido ? 'Vencido em ' : 'Vencimento: '}
                    {data(boleto.vencimento)}
                  </p>
                </div>
                <div className="as-acoes-coluna">
                  <button
                    type="button"
                    className="as-botao"
                    onClick={() =>
                      void copiar(boleto.pixCopiaECola, 'Código PIX')
                    }
                  >
                    Pagar com PIX
                  </button>
                  <button
                    type="button"
                    className="as-botao as-botao-claro"
                    onClick={() =>
                      void copiar(boleto.linhaDigitavel, 'Linha digitável')
                    }
                  >
                    Pagar boleto
                  </button>
                </div>
              </>
            ) : (
              <div>
                <p className="as-etiqueta">Nenhum boleto em aberto</p>
                <p className="as-vencimento">
                  {p.recorrente
                    ? 'Quando houver um boleto, ele ficará disponível nesta área e será enviado por e-mail.'
                    : 'Você pode pedir a cobrança recorrente ou solicitar um boleto para um único mês.'}
                </p>
              </div>
            )}
          </section>

          <div className="as-grade-2">
            <section className="as-cartao as-opcao">
              <h2>Envio Automático Todo Mês (Recorrente)</h2>
              <p>
                Peça o envio mensal de boletos. A cobrança recorrente é ativada
                automaticamente.
              </p>
              <button
                type="button"
                className="as-botao"
                disabled={p.recorrente}
                onClick={() => void recorrencia(true)}
              >
                {p.recorrente
                  ? 'Envio automático ativo'
                  : 'Ativar envio automático mensal'}
              </button>
            </section>
            <section className="as-cartao as-opcao">
              <h2>Boleto de um único mês</h2>
              <p>
                Solicite um boleto para pagar um único mês, sem aderir à
                cobrança recorrente.
              </p>
              <button
                type="button"
                className="as-botao as-botao-claro"
                disabled={!p.recorrente}
                onClick={() => void recorrencia(false)}
              >
                Solicitar boleto apenas deste mês
              </button>
            </section>
          </div>

          <section className="as-cartao as-anual" aria-labelledby="t-anual">
            <div>
              <p className="as-etiqueta as-etiqueta-escura">PLANO ANUAL</p>
              <h2 id="t-anual">Plano anual pago à vista tem 20% de desconto</h2>
            </div>
            <button
              type="button"
              className="as-botao"
              disabled
              title="A opção de pagamento anual ainda não está disponível."
            >
              Pagamento anual indisponível
            </button>
          </section>

          <section className="as-cartao as-rodape-cartao">
            <Link to="/associado/historico" className="as-botao as-botao-claro">
              Ver histórico de pagamentos anteriores
            </Link>
          </section>
        </>
      )}
    </>
  );
}
