import {
  TERMO_ADESAO,
  type AdesaoFeita,
  type SituacaoAdesao,
} from '@eloconnect/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailBoletoService } from './email-boleto.service.js';
import { emitirBoleto } from './emissao.js';
import { GatewayPagamento } from './gateway-pagamento.js';
import { TransacoesService } from './transacoes.service.js';
import {
  competenciaDaData,
  dataDaCompetencia,
  hojeEmMatoGrosso,
  valorDoMes,
} from './valor-do-mes.js';

const UM_DIA = 24 * 60 * 60 * 1000;

/**
 * Dias entre a adesão e o vencimento do boleto gerado na hora.
 * TODO(P16): provisório, até o cliente dizer o vencimento desse boleto.
 */
export const DIAS_VENCIMENTO_ADESAO = 10;

/**
 * Adesão à cobrança recorrente pelo próprio associado (US33: RF36, RN23,
 * RN27). Ele aceita o termo, a contribuição ativa liga na hora, sem aprovação
 * da sede, e o boleto deste mês sai na hora, com o valor cheio, já emitido no
 * banco e enviado por e-mail. O aceite fica guardado com a data, a hora e a
 * versão do termo (resposta 19).
 */
@Injectable()
export class AdesaoService {
  private readonly logger = new Logger(AdesaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transacoes: TransacoesService,
    private readonly gateway: GatewayPagamento,
    private readonly emailBoleto: EmailBoletoService,
  ) {}

  async situacao(
    usuarioId: string,
    agora = new Date(),
  ): Promise<SituacaoAdesao> {
    const { associado } = await this.associadoDe(usuarioId);
    const valor = await valorDoMes(this.prisma, competenciaAtual(agora));
    return {
      recebeBoletoMensal: associado.contribuicaoAtiva,
      valorMensal: valor?.toFixed(2) ?? null,
    };
  }

  async aderir(
    usuarioId: string,
    versaoTermo: string,
    agora = new Date(),
  ): Promise<AdesaoFeita> {
    if (versaoTermo !== TERMO_ADESAO.versao) {
      throw new BadRequestException({
        message: 'O termo mudou. Leia o termo de novo e confirme.',
        campo: 'versaoTermo',
      });
    }
    const { associadoId, associado } = await this.associadoDe(usuarioId);
    if (associado.inativadoEm) {
      // TODO(P13): o que a inativação muda na cobrança recorrente.
      throw new BadRequestException(
        'O cadastro da farmácia está inativo. Fale com a sede do sindicato.',
      );
    }
    const competencia = competenciaAtual(agora);

    const boletoId = await this.prisma.$transaction(
      async (tx) => {
        const valor = await valorDoMes(tx, competencia);
        if (!valor) {
          throw new BadRequestException(
            'A sede ainda não cadastrou o valor da contribuição.',
          );
        }
        // O update trava o associado: dois pedidos juntos aderem uma vez só.
        const { count } = await tx.associado.updateMany({
          where: { id: associadoId, contribuicaoAtiva: false },
          // Aderir de novo desfaz a interrupção pela sede (RN25).
          data: { contribuicaoAtiva: true, cobrancaInterrompidaEm: null },
        });
        if (count === 0) {
          throw new ConflictException(
            'A farmácia já recebe o boleto todo mês.',
          );
        }
        await tx.adesaoCobranca.create({
          data: { associadoId, usuarioId, versaoTermo, aceitaEm: agora },
        });

        // Quem já tem o boleto deste mês não recebe outro.
        const existente = await tx.boleto.findFirst({
          where: { associadoId, competencia, status: { not: 'CANCELADO' } },
          select: { id: true },
        });
        if (existente) return null;
        const boleto = await this.transacoes.criarBoleto(tx, {
          associadoId,
          tipo: 'MENSAL',
          competencia,
          valor,
          vencimento: new Date(
            hojeEmMatoGrosso(agora).getTime() + DIAS_VENCIMENTO_ADESAO * UM_DIA,
          ),
        });
        // Se o banco falha, a adesão toda é desfeita, e o associado tenta de
        // novo: nada fica pela metade.
        await emitirBoleto(tx, this.gateway, this.transacoes, boleto.id);
        return boleto.id;
      },
      { timeout: 30_000 },
    );

    if (boletoId) {
      try {
        await this.emailBoleto.enviar(boletoId);
      } catch (erro) {
        // O boleto já está em "Meus boletos", e os lembretes também o levam.
        this.logger.error(
          `O e-mail do boleto ${boletoId}, da adesão, não saiu.`,
          erro instanceof Error ? erro.stack : undefined,
        );
      }
    }
    return { boletoGerado: boletoId !== null };
  }

  private async associadoDe(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        associadoId: true,
        associado: { select: { contribuicaoAtiva: true, inativadoEm: true } },
      },
    });
    if (!usuario?.associadoId || !usuario.associado) {
      throw new NotFoundException('Associado não encontrado.');
    }
    return { associadoId: usuario.associadoId, associado: usuario.associado };
  }
}

/** O primeiro dia do mês de hoje, no horário de Mato Grosso. */
function competenciaAtual(agora: Date): Date {
  return dataDaCompetencia(competenciaDaData(hojeEmMatoGrosso(agora)));
}
