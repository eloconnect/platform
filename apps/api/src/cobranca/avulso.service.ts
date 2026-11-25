import type {
  AvulsoGerado,
  MotivoSemAvulso,
  SituacaoAvulso,
} from '@eloconnect/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DIAS_VENCIMENTO_ADESAO } from './adesao.service.js';
import { ultimoDiaDaCobertura } from './cobertura.js';
import { emitirBoleto } from './emissao.js';
import { GatewayPagamento } from './gateway-pagamento.js';
import { TransacoesService } from './transacoes.service.js';
import {
  competenciaDaData,
  dataDaCompetencia,
  hojeEmMatoGrosso,
  textoDia,
  valorDoMes,
} from './valor-do-mes.js';

const UM_DIA = 24 * 60 * 60 * 1000;

/** O texto que o associado lê quando não pode pedir o boleto. */
const MENSAGEM = {
  RECEBE_BOLETO_MENSAL: 'A farmácia já recebe o boleto todo mês.',
  BOLETO_EM_ABERTO:
    'A farmácia já tem um boleto para pagar. Ele está em "Meus boletos".',
  BOLETO_EXPIRADO:
    'A farmácia tem meses em aberto. Para voltar a ficar em dia, peça o boleto dos meses em aberto.',
  MES_JA_PAGO: 'O boleto deste mês já foi pago.',
  SEM_VALOR: 'A sede ainda não cadastrou o valor da contribuição.',
  INATIVO: 'O cadastro da farmácia está inativo. Fale com a sede do sindicato.',
} satisfies Record<MotivoSemAvulso, string>;

/**
 * Os motivos, com o tipo local: no lint do CI, que roda sem o shared
 * compilado, um tipo do shared numa união vira erro.
 */
type Motivo = keyof typeof MENSAGEM;

/**
 * Boleto avulso (US34: RF37, RN24): quem não recebe o boleto todo mês paga só
 * o mês atual. O boleto sai na hora, já emitido no banco, sem aprovação da
 * sede, e aparece em "Meus boletos". Regras da P10 decididas pelo grupo, com
 * aval do cliente (24/11/2026):
 * - vence 10 dias depois do pedido, como o boleto da adesão;
 * - não vai por e-mail nem tem lembretes, a pedido da sede no card sorting;
 * - um por mês: o boleto do mês continua em "Meus boletos" até ser pago, e
 *   não há segundo pedido;
 * - pago, deixa a farmácia em dia até o último dia para pagar o mês seguinte
 *   (o bloqueio diário cuida do fim do acesso).
 */
@Injectable()
export class AvulsoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transacoes: TransacoesService,
    private readonly gateway: GatewayPagamento,
  ) {}

  async situacao(
    usuarioId: string,
    agora = new Date(),
  ): Promise<SituacaoAvulso> {
    const associadoId = await this.associadoDe(usuarioId);
    const { motivo, valor } = await this.conferir(
      this.prisma,
      associadoId,
      agora,
    );
    return {
      motivo,
      valor: valor?.toFixed(2) ?? null,
      vencimento: textoDia(vencimentoDoPedido(agora)),
      emDiaAte: textoDia(ultimoDiaDaCobertura(competenciaAtual(agora))),
    };
  }

  async pedir(usuarioId: string, agora = new Date()): Promise<AvulsoGerado> {
    const associadoId = await this.associadoDe(usuarioId);
    const boletoId = await this.prisma.$transaction(
      async (tx) => {
        // Trava o associado: dois cliques juntos geram um boleto só.
        await tx.$queryRaw`SELECT id FROM "Associado" WHERE id = ${associadoId}::uuid FOR UPDATE`;
        const { motivo, valor } = await this.conferir(tx, associadoId, agora);
        if (motivo || !valor) {
          const mensagem = MENSAGEM[motivo ?? 'SEM_VALOR'];
          throw motivo === 'SEM_VALOR' || motivo === 'INATIVO'
            ? new BadRequestException(mensagem)
            : new ConflictException(mensagem);
        }
        const boleto = await this.transacoes.criarBoleto(tx, {
          associadoId,
          tipo: 'AVULSO',
          competencia: competenciaAtual(agora),
          valor,
          vencimento: vencimentoDoPedido(agora),
        });
        // Se o banco falha, nada fica pela metade: o associado tenta de novo.
        await emitirBoleto(tx, this.gateway, this.transacoes, boleto.id);
        return boleto.id;
      },
      { timeout: 30_000 },
    );
    return { boletoId };
  }

  private async conferir(
    tx: Prisma.TransactionClient,
    associadoId: string,
    agora: Date,
  ): Promise<{ motivo: Motivo | null; valor: Prisma.Decimal | null }> {
    const competencia = competenciaAtual(agora);
    const [associado, valor, boletos] = await Promise.all([
      tx.associado.findUniqueOrThrow({
        where: { id: associadoId },
        select: { contribuicaoAtiva: true, inativadoEm: true },
      }),
      valorDoMes(tx, competencia),
      tx.boleto.findMany({
        where: {
          associadoId,
          OR: [
            { status: { in: ['EM_ABERTO', 'EXPIRADO', 'RASCUNHO'] } },
            { status: 'PAGO', competencia },
          ],
        },
        select: { status: true },
      }),
    ]);
    const tem = (status: string) => boletos.some((b) => b.status === status);
    let motivo: Motivo | null = null;
    // TODO(P13): o que a inativação muda na cobrança.
    if (associado.inativadoEm) motivo = 'INATIVO';
    else if (associado.contribuicaoAtiva) motivo = 'RECEBE_BOLETO_MENSAL';
    else if (tem('EXPIRADO')) motivo = 'BOLETO_EXPIRADO';
    else if (tem('EM_ABERTO') || tem('RASCUNHO')) motivo = 'BOLETO_EM_ABERTO';
    else if (tem('PAGO')) motivo = 'MES_JA_PAGO';
    else if (!valor) motivo = 'SEM_VALOR';
    return { motivo, valor };
  }

  private async associadoDe(usuarioId: string): Promise<string> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { associadoId: true },
    });
    if (!usuario?.associadoId) {
      throw new NotFoundException('Associado não encontrado.');
    }
    return usuario.associadoId;
  }
}

/** O primeiro dia do mês de hoje, no horário de Mato Grosso. */
function competenciaAtual(agora: Date): Date {
  return dataDaCompetencia(competenciaDaData(hojeEmMatoGrosso(agora)));
}

/** O avulso vence 10 dias depois do pedido, como o boleto da adesão (P10). */
function vencimentoDoPedido(agora: Date): Date {
  return new Date(
    hojeEmMatoGrosso(agora).getTime() + DIAS_VENCIMENTO_ADESAO * UM_DIA,
  );
}
