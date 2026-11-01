import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  competenciaDoNovoValor,
  formatarReais,
  textoCompetencia,
  type Competencia,
  type ProximoBoleto,
} from '@eloconnect/shared';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { EmailService } from '../email/email.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { dataDaCompetencia, valorDoMes } from './valor-do-mes.js';

const ASSOCIADO = {
  id: true,
  razaoSocial: true,
  nomeFantasia: true,
  email: true,
  contribuicaoAtiva: true,
  inativadoEm: true,
} satisfies Prisma.AssociadoSelect;

type DadosAssociado = Prisma.AssociadoGetPayload<{ select: typeof ASSOCIADO }>;

/** Mudança feita, para o aviso por e-mail depois da transação. */
interface Mudanca {
  associado: DadosAssociado;
  competencia: Competencia;
  anterior: string;
  novo: string;
  voltouAoNormal: boolean;
}

/**
 * Edição do boleto mensal pela sede (US11: RF11, RN04). A sede muda o valor
 * do boleto de um associado só para um mês: a edição feita num mês vale para
 * o boleto do mês seguinte, como a mudança de valor da contribuição (RN15), e
 * pode ser trocada ou desfeita até o mês virar. O associado é avisado por
 * e-mail na hora. O lote mensal usa o valor editado ao gerar o boleto.
 * TODO(#40): mudar outros dados do boleto depende do que o Sicredi aceita.
 */
@Injectable()
export class EdicaoBoletoService {
  private readonly logger = new Logger(EdicaoBoletoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly email: EmailService,
  ) {}

  /**
   * Boleto do mês seguinte, ou nulo para quem não recebe o boleto mensal.
   * Sem anotar o retorno: no lint do CI, que roda sem o shared compilado, um
   * tipo do shared numa união vira erro.
   */
  async proximoBoleto(
    associado: Pick<DadosAssociado, 'id' | 'contribuicaoAtiva' | 'inativadoEm'>,
    agora = new Date(),
  ) {
    if (!recebeBoleto(associado)) return null;
    const competencia = competenciaDoNovoValor(agora);
    const data = dataDaCompetencia(competencia);
    const [normal, edicao] = await Promise.all([
      valorDoMes(this.prisma, data),
      this.prisma.edicaoBoleto.findUnique({
        where: {
          associadoId_competencia: {
            associadoId: associado.id,
            competencia: data,
          },
        },
        select: { valor: true },
      }),
    ]);
    return {
      competencia,
      valorNormal: normal?.toFixed(2) ?? null,
      valorEditado: edicao?.valor.toFixed(2) ?? null,
    } satisfies ProximoBoleto;
  }

  /** Muda o valor do boleto do mês seguinte e avisa o associado. */
  async editar(
    usuarioId: string,
    associadoId: string,
    valorTexto: string,
    agora = new Date(),
  ): Promise<ProximoBoleto> {
    // "0130.00" e "130.00" são o mesmo valor.
    const valor = Number(valorTexto).toFixed(2);
    if (Number(valor) <= 0) {
      throw new BadRequestException({
        message: 'O valor precisa ser maior que zero.',
        campo: 'valor',
      });
    }
    const competencia = competenciaDoNovoValor(agora);
    const data = dataDaCompetencia(competencia);

    const mudanca = await this.prisma.$transaction(async (tx) => {
      const associado = await buscarAssociado(tx, associadoId);
      if (!recebeBoleto(associado)) {
        throw new BadRequestException(
          'Este associado não recebe o boleto mensal.',
        );
      }
      const normal = await valorNormal(tx, data);
      const chave = {
        associadoId_competencia: { associadoId, competencia: data },
      };
      const atual = await tx.edicaoBoleto.findUnique({
        where: chave,
        select: { valor: true },
      });
      const anterior = atual?.valor.toFixed(2) ?? normal;
      if (valor === anterior) {
        throw new BadRequestException({
          message: 'O boleto já está com este valor.',
          campo: 'valor',
        });
      }
      if (valor === normal) {
        throw new BadRequestException({
          message:
            'Este já é o valor normal da contribuição. Para voltar a ele, use "Voltar ao valor normal".',
          campo: 'valor',
        });
      }
      const edicao = await tx.edicaoBoleto.upsert({
        where: chave,
        create: { associadoId, competencia: data, valor },
        update: { valor },
        select: { id: true },
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        acao: 'BOLETO_VALOR_EDITADO',
        entidade: 'EdicaoBoleto',
        entidadeId: edicao.id,
        associadoId,
        valorAnterior: { valor: anterior },
        valorNovo: { competencia: textoMes(competencia), valor },
      });
      return { associado, anterior, normal };
    });

    this.avisar({
      associado: mudanca.associado,
      competencia,
      anterior: mudanca.anterior,
      novo: valor,
      voltouAoNormal: false,
    });
    return { competencia, valorNormal: mudanca.normal, valorEditado: valor };
  }

  /** Desfaz a edição: o boleto do mês seguinte volta ao valor normal. */
  async voltarAoNormal(
    usuarioId: string,
    associadoId: string,
    agora = new Date(),
  ): Promise<ProximoBoleto> {
    const competencia = competenciaDoNovoValor(agora);
    const data = dataDaCompetencia(competencia);

    const mudanca = await this.prisma.$transaction(async (tx) => {
      const associado = await buscarAssociado(tx, associadoId);
      const chave = {
        associadoId_competencia: { associadoId, competencia: data },
      };
      const edicao = await tx.edicaoBoleto.findUnique({ where: chave });
      // Se duas pessoas desfazem juntas, só a primeira apaga.
      const { count } = edicao
        ? await tx.edicaoBoleto.deleteMany({ where: { id: edicao.id } })
        : { count: 0 };
      if (!edicao || count === 0) {
        throw new BadRequestException(
          'O boleto já está com o valor normal da contribuição.',
        );
      }
      const normal = await valorNormal(tx, data);
      const anterior = edicao.valor.toFixed(2);
      await this.auditoria.registrar(tx, {
        usuarioId,
        acao: 'BOLETO_VALOR_NORMAL',
        entidade: 'EdicaoBoleto',
        entidadeId: edicao.id,
        associadoId,
        valorAnterior: { valor: anterior },
        valorNovo: { competencia: textoMes(competencia), valor: normal },
      });
      return { associado, anterior, normal };
    });

    this.avisar({
      associado: mudanca.associado,
      competencia,
      anterior: mudanca.anterior,
      novo: mudanca.normal,
      voltouAoNormal: true,
    });
    return { competencia, valorNormal: mudanca.normal, valorEditado: null };
  }

  /**
   * Avisa o associado na hora (RN04). Não aguarda o envio: a edição já foi
   * gravada, e o aviso não pode desfazê-la.
   */
  private avisar({
    associado,
    competencia,
    anterior,
    novo,
    voltouAoNormal,
  }: Mudanca) {
    if (!associado.email) return;
    const mes = textoCompetencia(competencia);
    const mensagem = {
      to: associado.email,
      subject: 'O valor do seu próximo boleto vai mudar - Elo Connect',
      text: [
        `Olá, ${associado.nomeFantasia ?? associado.razaoSocial}.`,
        '',
        voltouAoNormal
          ? `O seu boleto de ${mes} volta ao valor normal da contribuição.`
          : `A sede do sindicato mudou o valor do seu boleto de ${mes}.`,
        '',
        `Valor anterior: ${formatarReais(anterior)}.`,
        `Novo valor: ${formatarReais(novo)}.`,
        '',
        'O vencimento continua no dia 10. Os boletos dos outros meses seguem o valor normal da contribuição.',
      ].join('\n'),
    };
    void this.email.send(mensagem).catch((error: unknown) => {
      this.logger.error(
        'Falha ao enviar o aviso de mudança no boleto.',
        error instanceof Error ? error.stack : undefined,
      );
    });
  }
}

async function buscarAssociado(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<DadosAssociado> {
  const associado = await tx.associado.findUnique({
    where: { id },
    select: ASSOCIADO,
  });
  if (!associado) {
    throw new NotFoundException('Associado não encontrado.');
  }
  return associado;
}

/** Valor da contribuição para o mês, em texto ("130.00"). */
async function valorNormal(
  tx: Prisma.TransactionClient,
  competencia: Date,
): Promise<string> {
  const valor = await valorDoMes(tx, competencia);
  if (!valor) {
    throw new BadRequestException(
      'A sede ainda não cadastrou o valor da contribuição.',
    );
  }
  return valor.toFixed(2);
}

/**
 * Quem recebe o boleto mensal: contribuição ativa e não inativado, como no
 * lote (RN05). TODO(P13): o que a inativação muda na cobrança recorrente.
 */
function recebeBoleto(
  associado: Pick<DadosAssociado, 'contribuicaoAtiva' | 'inativadoEm'>,
): boolean {
  return associado.contribuicaoAtiva && associado.inativadoEm === null;
}

/** { ano: 2026, mes: 12 } vira "2026-12", como no log. */
function textoMes({ ano, mes }: Competencia): string {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}
