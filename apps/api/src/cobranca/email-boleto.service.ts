import { formatarReais, textoCompetencia } from '@eloconnect/shared';
import { Injectable } from '@nestjs/common';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GatewayPagamento, validoAte } from './gateway-pagamento.js';
import { qrCodePix } from './qr-code-pix.js';
import { competenciaDaData } from './valor-do-mes.js';

/** Liga a imagem anexada ao `<img>` do HTML. */
const CID_QR_CODE = 'qr-code-pix';
/** Tamanho de cada módulo do QR Code na imagem, em pixels. */
const CELULA = 8;

/** O que o e-mail mostra, já formatado. */
interface Conteudo {
  nome: string;
  mes: string;
  valor: string;
  vencimento: string;
  pixCopiaECola: string;
  linhaDigitavel: string;
}

/**
 * E-mail com o boleto (US12: RF12, RN06). O valor e o vencimento vêm em
 * destaque, seguidos do QR Code e do código do Pix Copia e Cola, da linha
 * digitável e do PDF do boleto, anexado. O e-mail vai em HTML, com uma versão
 * em texto para quem não vê imagens.
 * TODO(#47): pôr o link da página com os boletos do associado.
 */
@Injectable()
export class EmailBoletoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: GatewayPagamento,
    private readonly email: EmailService,
  ) {}

  /**
   * Manda o e-mail do boleto emitido e guarda quando ele saiu. Se o envio
   * falha, o erro sobe e o boleto fica sem `emailEnviadoEm`, para a próxima
   * execução do lote tentar de novo.
   */
  async enviar(boletoId: string): Promise<void> {
    const boleto = await this.prisma.boleto.findUniqueOrThrow({
      where: { id: boletoId },
      include: {
        associado: {
          select: {
            cnpj: true,
            razaoSocial: true,
            nomeFantasia: true,
            email: true,
          },
        },
      },
    });
    const {
      associado,
      sicrediNossoNumero: nossoNumero,
      linhaDigitavel,
      pixCopiaECola,
    } = boleto;
    if (!associado.email || !nossoNumero || !linhaDigitavel || !pixCopiaECola) {
      throw new Error(`O boleto ${boletoId} não tem como ir por e-mail.`);
    }

    const pdf = await this.gateway.pdf({
      boletoId,
      valor: boleto.valor,
      vencimento: boleto.vencimento,
      validoAte: validoAte(boleto.vencimento),
      pagador: { cnpj: associado.cnpj, nome: associado.razaoSocial },
      nossoNumero,
      linhaDigitavel,
      pixCopiaECola,
    });
    const qr = qrCodePix(pixCopiaECola);
    const margem = 4 * CELULA;
    const lado = qr.getModuleCount() * CELULA + 2 * margem;
    const gif = qr.createDataURL(CELULA, margem).split(',')[1];
    const conteudo: Conteudo = {
      nome: associado.nomeFantasia ?? associado.razaoSocial,
      mes: textoCompetencia(competenciaDaData(boleto.competencia)),
      valor: formatarReais(boleto.valor.toFixed(2)),
      // A data do boleto é um dia, guardado à meia-noite UTC.
      vencimento: boleto.vencimento.toLocaleDateString('pt-BR', {
        timeZone: 'UTC',
      }),
      pixCopiaECola,
      linhaDigitavel,
    };

    await this.email.send({
      to: associado.email,
      subject: `Seu boleto de ${conteudo.mes} - Elo Connect`,
      text: texto(conteudo),
      html: html(conteudo, lado),
      attachments: [
        {
          filename: `boleto-${boleto.competencia.toISOString().slice(0, 7)}.pdf`,
          content: pdf,
          contentType: 'application/pdf',
        },
        {
          filename: 'qr-code-pix.gif',
          content: Buffer.from(gif, 'base64'),
          contentType: 'image/gif',
          cid: CID_QR_CODE,
        },
      ],
    });
    // Controle do envio, como o `ultimoLembreteEm`: não muda o boleto e não
    // entra no histórico de transações.
    await this.prisma.boleto.update({
      where: { id: boletoId },
      data: { emailEnviadoEm: new Date() },
    });
  }
}

function texto(conteudo: Conteudo): string {
  return [
    `Olá, ${conteudo.nome}.`,
    '',
    `O boleto de ${conteudo.mes} da sua contribuição ao sindicato está pronto.`,
    '',
    `Valor: ${conteudo.valor}`,
    `Vencimento: ${conteudo.vencimento}`,
    '',
    'Para pagar com Pix, copie o código abaixo e use a opção Pix Copia e Cola no aplicativo do seu banco:',
    conteudo.pixCopiaECola,
    '',
    'Para pagar com o boleto, abra o PDF anexado a este e-mail ou use a linha digitável:',
    conteudo.linhaDigitavel,
  ].join('\n');
}

/** HTML simples, com estilo em cada tag, como os programas de e-mail pedem. */
function html(conteudo: Conteudo, ladoQrCode: number): string {
  const e = (campo: keyof Conteudo) => escaparHtml(conteudo[campo]);
  const titulo = 'style="font-size:20px;margin:32px 0 8px"';
  const codigo =
    'style="font-family:\'Courier New\',monospace;word-break:break-all"';
  return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0">
<div style="padding:24px;background:#ffffff;color:#1a1a1a;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.5">
<p>Olá, ${e('nome')}.</p>
<p>O boleto de ${e('mes')} da sua contribuição ao sindicato está pronto.</p>
<p style="font-size:24px"><strong>Valor: ${e('valor')}</strong><br><strong>Vencimento: ${e('vencimento')}</strong></p>
<h2 ${titulo}>Pagar com Pix</h2>
<p>No aplicativo do seu banco, escolha pagar com Pix e leia o QR Code:</p>
<img src="cid:${CID_QR_CODE}" width="${ladoQrCode}" height="${ladoQrCode}" alt="QR Code do Pix">
<p>Ou copie o código abaixo e use a opção Pix Copia e Cola:</p>
<p ${codigo}>${e('pixCopiaECola')}</p>
<h2 ${titulo}>Pagar com o boleto</h2>
<p>O boleto está anexado a este e-mail, em PDF. Se preferir, use a linha digitável:</p>
<p ${codigo}>${e('linhaDigitavel')}</p>
</div>
</body>
</html>`;
}

function escaparHtml(valor: string): string {
  return valor.replace(
    /[&<>"']/g,
    (caractere) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        caractere
      ] ?? caractere,
  );
}
