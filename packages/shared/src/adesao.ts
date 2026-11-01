/**
 * Termo de adesão à cobrança recorrente (RN23). O associado aceita esta versão
 * para aderir, e o sistema guarda a versão aceita, com a data e a hora
 * (resposta 19).
 *
 * TODO(P21): texto provisório, só com regras já validadas, até chegar o texto
 * dos advogados do sindicato. Quando ele chegar, troque os parágrafos e a
 * versão.
 */
export const TERMO_ADESAO = {
  versao: 'provisorio-2026-11-02',
  paragrafos: [
    'Texto provisório. O termo definitivo será escrito pelos advogados do sindicato.',
    'Ao aderir, a farmácia passa a receber todo mês, por e-mail e no site, o boleto da contribuição ao sindicato, com Pix e vencimento no dia 10.',
    'O boleto deste mês é gerado na hora, com o valor cheio do mês.',
    'Não há juros nem multa por atraso. Se o boleto não for pago em até 30 dias depois do vencimento, o acesso a benefícios e suporte fica bloqueado até o pagamento.',
  ],
} as const;

/** A adesão à cobrança recorrente, para o associado logado (RN23). */
export interface SituacaoAdesao {
  /** A farmácia já recebe o boleto todo mês. */
  recebeBoletoMensal: boolean;
  /**
   * Valor do boleto deste mês, em reais, com ponto e duas casas ("120.00").
   * Nulo enquanto a sede não cadastrou o valor.
   */
  valorMensal: string | null;
}

/** Pedido de adesão, com a versão do termo que o associado leu e aceitou. */
export interface AderirRequest {
  versaoTermo: string;
}

/** O que a adesão fez. */
export interface AdesaoFeita {
  /** Falso quando a farmácia já tinha o boleto deste mês. */
  boletoGerado: boolean;
}
