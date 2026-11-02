import { formatarCnpj, formatarReais } from '@eloconnect/shared';
import type { BoletoEmitido, PedidoBoleto } from './gateway-pagamento.js';
import { ALTURA, MARGEM, montarPdf, texto, type Fonte } from './pdf.js';
import { qrCodePix } from './qr-code-pix.js';

/** Lado de cada quadrado do QR Code, em pontos. */
const MODULO = 4;

/**
 * PDF do boleto do banco simulado: uma página com os dados do boleto, o QR
 * Code do Pix e o aviso de que nenhum banco aceita o boleto. Só serve à
 * simulação: o PDF de verdade vem do banco.
 */
export function pdfSimulado(boleto: PedidoBoleto & BoletoEmitido): Buffer {
  const comandos: string[] = [];
  let y = ALTURA - MARGEM;
  const escrever = (conteudo: string, tamanho = 12, fonte: Fonte = 'F1') => {
    y -= tamanho * 1.5;
    comandos.push(texto(MARGEM, y, conteudo, tamanho, fonte));
  };

  escrever('BOLETO SIMULADO - NÃO PAGUE', 18, 'F2');
  escrever('Feito pelo banco simulado do Elo Connect, só para testes.');
  escrever('Nenhum banco aceita este boleto.');
  y -= 12;
  escrever(`Pagador: ${boleto.pagador.nome}`);
  escrever(`CNPJ: ${formatarCnpj(boleto.pagador.cnpj)}`);
  y -= 12;
  escrever(`Valor: ${formatarReais(boleto.valor.toFixed(2))}`, 14, 'F2');
  escrever(`Vencimento: ${dia(boleto.vencimento)}`, 14, 'F2');
  escrever(`Pague até: ${dia(boleto.validoAte)}`);
  escrever(`Nosso número: ${boleto.nossoNumero}`);
  y -= 12;
  escrever('Linha digitável', 12, 'F2');
  escrever(boleto.linhaDigitavel, 11, 'F3');
  y -= 12;
  escrever('Pix', 12, 'F2');

  // Um quadrado preto para cada módulo escuro do QR Code.
  const qr = qrCodePix(boleto.pixCopiaECola);
  const modulos = qr.getModuleCount();
  y -= 12 + modulos * MODULO;
  for (let linha = 0; linha < modulos; linha++) {
    for (let coluna = 0; coluna < modulos; coluna++) {
      if (qr.isDark(linha, coluna)) {
        const x = MARGEM + coluna * MODULO;
        const base = y + (modulos - 1 - linha) * MODULO;
        comandos.push(`${x} ${base} ${MODULO} ${MODULO} re`);
      }
    }
  }
  comandos.push('f');

  y -= 6;
  escrever('Pix Copia e Cola', 12, 'F2');
  for (const parte of boleto.pixCopiaECola.match(/.{1,80}/g) ?? []) {
    escrever(parte, 9, 'F3');
  }
  return montarPdf([comandos.join('\n')]);
}

/** As datas do boleto são dias, guardados à meia-noite UTC. */
function dia(data: Date): string {
  return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
