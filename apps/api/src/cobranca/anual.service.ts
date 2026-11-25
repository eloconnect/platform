import type {
  AnualGerado,
  MotivoSemAnual,
  SituacaoAnual,
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
import {
  MESES_PLANO_ANUAL,
  planoAnualAte,
  somarMeses,
  ultimoDiaDaCobertura,
} from './cobertura.js';
import { emitirBoleto } from './emissao.js';
import { GatewayPagamento } from './gateway-pagamento.js';
import { TransacoesService } from './transacoes.service.js';
import {
  competenciaDaData,
  dataDaCompetencia,
  hojeEmMatoGrosso,
  textoDia,
  valorAnualDoMes,
  valorDoMes,
} from './valor-do-mes.js';

type Tx = Prisma.TransactionClient;

const UM_DIA = 24 * 60 * 60 * 1000;

/** O texto que o associado lê quando não pode pedir o plano. */
const MENSAGEM = {
  PLANO_EM_VIGOR: 'O plano anual da farmácia ainda está valendo.',
  BOLETO_EM_ABERTO:
    'A farmácia já tem um boleto para pagar. Ele está em "Meus boletos".',
  BOLETO_EXPIRADO:
    'A farmácia tem meses em aberto. Para voltar a ficar em dia, peça o boleto dos meses em aberto.',
  SEM_VALOR: 'A sede ainda não cadastrou o valor da contribuição.',
  INATIVO: 'O cadastro da farmácia está inativo. Fale com a sede do sindicato.',
} satisfies Record<MotivoSemAnual, string>;

/**
 * Os motivos, com o tipo local: no lint do CI, que roda sem o shared
 * compilado, um tipo do shared numa união vira erro.
 */
type Motivo = keyof typeof MENSAGEM;

/**
 * Plano anual à vista, com 20% de desconto (US17: RF17, RN13). O associado
 * pede pelo site, recebendo ou não o boleto todo mês, e o boleto sai na hora,
 * já emitido no banco, como o avulso. Regras da P04 decididas pelo grupo, com
 * aval do cliente (24/11/2026):
 * - o plano cobre 12 meses, a partir deste mês, ou do mês seguinte se o
 *   boleto deste mês já saiu;
 * - o lote mensal pula os meses cobertos, e, no fim do plano, quem recebe o
 *   boleto todo mês volta a recebê-lo; não há renovação automática;
 * - quem não recebe o boleto todo mês fica em dia até o último dia para pagar
 *   o mês seguinte ao fim do plano, como no avulso;
 * - vence 10 dias depois do pedido e não vai por e-mail, como o avulso.
 */
@Injectable()
export class AnualService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transacoes: TransacoesService,
    private readonly gateway: GatewayPagamento,
  ) {}

  async situacao(
    usuarioId: string,
    agora = new Date(),
  ): Promise<SituacaoAnual> {
    const associadoId = await this.associadoDe(usuarioId);
    const c = await this.conferir(this.prisma, associadoId, agora);
    const ultimo = somarMeses(c.primeiroMes, MESES_PLANO_ANUAL - 1);
    return {
      motivo: c.motivo,
      valorAnual: c.valorAnual?.toFixed(2) ?? null,
      valorMensal: c.valorMensal?.toFixed(2) ?? null,
      primeiroMes: competenciaDaData(c.primeiroMes),
      ultimoMes: competenciaDaData(ultimo),
      vencimento: textoDia(vencimentoDoPedido(agora)),
      emDiaAte: textoDia(ultimoDiaDaCobertura(ultimo)),
      planoAte: c.planoAte && competenciaDaData(c.planoAte),
    };
  }

  async pedir(usuarioId: string, agora = new Date()): Promise<AnualGerado> {
    const associadoId = await this.associadoDe(usuarioId);
    const boletoId = await this.prisma.$transaction(
      async (tx) => {
        // Trava o associado: dois cliques juntos geram um boleto só.
        await tx.$queryRaw`SELECT id FROM "Associado" WHERE id = ${associadoId}::uuid FOR UPDATE`;
        const c = await this.conferir(tx, associadoId, agora);
        if (c.motivo || !c.valorAnual) {
          const motivo = c.motivo ?? 'SEM_VALOR';
          throw motivo === 'SEM_VALOR' || motivo === 'INATIVO'
            ? new BadRequestException(MENSAGEM[motivo])
            : new ConflictException(MENSAGEM[motivo]);
        }
        const boleto = await this.transacoes.criarBoleto(tx, {
          associadoId,
          tipo: 'ANUAL',
          // O primeiro dos 12 meses que o plano cobre.
          competencia: c.primeiroMes,
          valor: c.valorAnual,
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

  private async conferir(tx: Tx, associadoId: string, agora: Date) {
    const mesAtual = dataDaCompetencia(
      competenciaDaData(hojeEmMatoGrosso(agora)),
    );
    const [associado, boletos, planoAte] = await Promise.all([
      tx.associado.findUniqueOrThrow({
        where: { id: associadoId },
        select: { inativadoEm: true },
      }),
      tx.boleto.findMany({
        where: {
          associadoId,
          OR: [
            { status: { in: ['EM_ABERTO', 'EXPIRADO', 'RASCUNHO'] } },
            { competencia: mesAtual, status: { not: 'CANCELADO' } },
          ],
        },
        select: { status: true, competencia: true },
      }),
      planoAnualAte(tx, associadoId, mesAtual),
    ]);
    // Se o boleto deste mês já saiu, o plano começa no mês seguinte.
    const primeiroMes = boletos.some(
      (b) => b.competencia.getTime() === mesAtual.getTime(),
    )
      ? somarMeses(mesAtual, 1)
      : mesAtual;
    const [valorAnual, valorMensal] = await Promise.all([
      valorAnualDoMes(tx, primeiroMes),
      valorDoMes(tx, primeiroMes),
    ]);
    const tem = (status: string) => boletos.some((b) => b.status === status);
    let motivo: Motivo | null = null;
    // TODO(P13): o que a inativação muda na cobrança.
    if (associado.inativadoEm) motivo = 'INATIVO';
    else if (planoAte) motivo = 'PLANO_EM_VIGOR';
    else if (tem('EXPIRADO')) motivo = 'BOLETO_EXPIRADO';
    else if (tem('EM_ABERTO') || tem('RASCUNHO')) motivo = 'BOLETO_EM_ABERTO';
    else if (!valorAnual) motivo = 'SEM_VALOR';
    return { motivo, valorAnual, valorMensal, primeiroMes, planoAte };
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

/** Vence 10 dias depois do pedido, como o avulso e a adesão. */
function vencimentoDoPedido(agora: Date): Date {
  return new Date(
    hojeEmMatoGrosso(agora).getTime() + DIAS_VENCIMENTO_ADESAO * UM_DIA,
  );
}
