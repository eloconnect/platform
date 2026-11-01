import { formatarReais, textoCompetencia } from '@eloconnect/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GatewayPagamento, validoAte } from './gateway-pagamento.js';
import { qrCodePix } from './qr-code-pix.js';
import { competenciaDaData } from './valor-do-mes.js';

/** Liga a imagem anexada ao `<img>` do HTML. */
const CID_QR_CODE = 'qr-code-pix';
/** Tamanho de cada módulo do QR Code na imagem, em pixels. */
const CELULA = 8;

/** O e-mail do boleto ou um dos lembretes (RN07). */
export type TipoEmailBoleto = 'BOLETO' | 'LEMBRETE_ANTES' | 'LEMBRETE_VENCIDO';

/** O que o e-mail mostra, já formatado. */
interface Conteudo {
  nome: string;
  mes: string;
  valor: string;
  vencimento: string;
  /** Último dia para pagar (RN03). */
  validoAte: string;
  pixCopiaECola: string;
  linhaDigitavel: string;
  /** Página "Meus boletos" no site. */
  site: string;
}

const ASSUNTOS: Record<TipoEmailBoleto, (conteudo: Conteudo) => string> = {
  BOLETO: ({ mes }) => `Seu boleto de ${mes} - Elo Connect`,
  LEMBRETE_ANTES: ({ mes, vencimento }) =>
    `Seu boleto de ${mes} vence em ${vencimento} - Elo Connect`,
  LEMBRETE_VENCIDO: ({ mes }) =>
    `Seu boleto de ${mes} está vencido - Elo Connect`,
};

/** Os parágrafos do começo do e-mail. */
const ABERTURAS: Record<TipoEmailBoleto, (conteudo: Conteudo) => string[]> = {
  BOLETO: ({ mes }) => [
    `O boleto de ${mes} da sua contribuição ao sindicato está pronto.`,
  ],
  LEMBRETE_ANTES: ({ mes, vencimento }) => [
    `Lembrete: o boleto de ${mes} da sua contribuição ao sindicato vence em ${vencimento}.`,
    'Se você já pagou, desconsidere este e-mail.',
  ],
  LEMBRETE_VENCIDO: ({ mes, vencimento, validoAte: ultimoDia }) => [
    `O boleto de ${mes} da sua contribuição ao sindicato venceu em ${vencimento} e ainda não consta como pago.`,
    `Você ainda pode pagar até ${ultimoDia}. Depois disso, o acesso a benefícios e suporte fica bloqueado até o pagamento.`,
    'Se você já pagou, desconsidere este e-mail.',
  ],
};

/**
 * E-mail com o boleto (US12: RF12, RN06) e os lembretes antes e depois do
 * vencimento (US13: RF13, RF14, RN07). O valor e o vencimento vêm em
 * destaque, seguidos do QR Code e do código do Pix Copia e Cola, da linha
 * digitável, do PDF do boleto, anexado, e do endereço da página "Meus
 * boletos". O e-mail vai em HTML, com uma versão em texto para quem não vê
 * imagens.
 */
@Injectable()
export class EmailBoletoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: GatewayPagamento,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Manda o e-mail do boleto emitido e guarda quando ele saiu: o do boleto em
   * `emailEnviadoEm`, o lembrete em `ultimoLembreteEm`. Se o envio falha, o
   * erro sobe e nada é guardado, para a próxima execução tentar de novo.
   */
  async enviar(
    boletoId: string,
    tipo: TipoEmailBoleto = 'BOLETO',
    agora = new Date(),
  ): Promise<void> {
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
    const web = this.config.get<string>('WEB_URL') ?? 'http://localhost:5173';
    const conteudo: Conteudo = {
      nome: associado.nomeFantasia ?? associado.razaoSocial,
      mes: textoCompetencia(competenciaDaData(boleto.competencia)),
      valor: formatarReais(boleto.valor.toFixed(2)),
      vencimento: dia(boleto.vencimento),
      validoAte: dia(validoAte(boleto.vencimento)),
      pixCopiaECola,
      linhaDigitavel,
      site: `${web.replace(/\/$/, '')}/associado/boletos`,
    };

    await this.email.send({
      to: associado.email,
      subject: ASSUNTOS[tipo](conteudo),
      text: texto(ABERTURAS[tipo](conteudo), conteudo),
      html: html(ABERTURAS[tipo](conteudo), conteudo, lado),
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
    // Controle do envio: não muda o boleto e não entra no histórico de
    // transações.
    await this.prisma.boleto.update({
      where: { id: boletoId },
      data:
        tipo === 'BOLETO'
          ? { emailEnviadoEm: agora }
          : { ultimoLembreteEm: agora },
    });
  }
}

function texto(abertura: string[], conteudo: Conteudo): string {
  return [
    `Olá, ${conteudo.nome}.`,
    '',
    ...abertura.flatMap((paragrafo) => [paragrafo, '']),
    `Valor: ${conteudo.valor}`,
    `Vencimento: ${conteudo.vencimento}`,
    '',
    'Para pagar com Pix, copie o código abaixo e use a opção Pix Copia e Cola no aplicativo do seu banco:',
    conteudo.pixCopiaECola,
    '',
    'Para pagar com o boleto, abra o PDF anexado a este e-mail ou use a linha digitável:',
    conteudo.linhaDigitavel,
    '',
    `Você também encontra este boleto no site, em Meus boletos: ${conteudo.site}`,
  ].join('\n');
}

/** HTML simples, com estilo em cada tag, como os programas de e-mail pedem. */
function html(
  abertura: string[],
  conteudo: Conteudo,
  ladoQrCode: number,
): string {
  const e = (campo: keyof Conteudo) => escaparHtml(conteudo[campo]);
  const titulo = 'style="font-size:20px;margin:32px 0 8px"';
  const codigo =
    'style="font-family:\'Courier New\',monospace;word-break:break-all"';
  return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0">
<div style="padding:24px;background:#ffffff;color:#1a1a1a;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.5">
<p>Olá, ${e('nome')}.</p>
${abertura.map((paragrafo) => `<p>${escaparHtml(paragrafo)}</p>`).join('\n')}
<p style="font-size:24px"><strong>Valor: ${e('valor')}</strong><br><strong>Vencimento: ${e('vencimento')}</strong></p>
<h2 ${titulo}>Pagar com Pix</h2>
<p>No aplicativo do seu banco, escolha pagar com Pix e leia o QR Code:</p>
<img src="cid:${CID_QR_CODE}" width="${ladoQrCode}" height="${ladoQrCode}" alt="QR Code do Pix">
<p>Ou copie o código abaixo e use a opção Pix Copia e Cola:</p>
<p ${codigo}>${e('pixCopiaECola')}</p>
<h2 ${titulo}>Pagar com o boleto</h2>
<p>O boleto está anexado a este e-mail, em PDF. Se preferir, use a linha digitável:</p>
<p ${codigo}>${e('linhaDigitavel')}</p>
<p>Você também encontra este boleto no site, em <a href="${e('site')}">Meus boletos</a>.</p>
</div>
</body>
</html>`;
}

/** As datas do boleto são dias, guardados à meia-noite UTC. */
function dia(data: Date): string {
  return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
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
