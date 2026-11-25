import {
  acessoManualEmVigor,
  formatarCnpj,
  podeAcessarRecursoRestrito,
  type BeneficiosAssociado,
  type PedidoSuporte,
} from '@eloconnect/shared';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { BeneficiosService } from '../beneficios/beneficios.service.js';
import { planoAnualAte } from '../cobranca/cobertura.js';
import {
  competenciaDaData,
  dataDaCompetencia,
  hojeEmMatoGrosso,
} from '../cobranca/valor-do-mes.js';
import { EmailService } from '../email/email.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { EnviarSuporteDto } from './dto/enviar-suporte.dto.js';

const CAMPOS = {
  id: true,
  assunto: true,
  mensagem: true,
  criadoEm: true,
  respondidoEm: true,
  respondidoPor: { select: { nome: true } },
  associado: { select: { id: true, razaoSocial: true, email: true } },
} satisfies Prisma.PedidoSuporteSelect;

/**
 * Benefícios e suporte (US25: RF25, RN32). Regras da P06 e da P15 decididas
 * pelo grupo, com aval do cliente (24/11/2026):
 * - a consultoria e o suporte valem para quem está em dia, a partir do
 *   primeiro boleto pago, ou liberado pela sede (RN11);
 * - a assessoria jurídica, que exige o "ano inteiro antecipado", vale com o
 *   plano anual pago em vigor (RN13) ou com a liberação da sede;
 * - a lista é a que a sede cadastra (RF24); o associado que não está em dia
 *   também a vê, com o aviso do que falta.
 *
 * O pedido de suporte vai por e-mail para os usuários da sede, com o e-mail
 * da farmácia para a resposta. A sede responde pelo e-mail e marca o pedido
 * como respondido, o que fica no log de auditoria (RN26).
 */
@Injectable()
export class SuporteService {
  private readonly logger = new Logger(SuporteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly beneficios: BeneficiosService,
    private readonly auditoria: AuditoriaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async meusBeneficios(usuarioId: string): Promise<BeneficiosAssociado> {
    const associado = await this.associadoDe(usuarioId);
    const manual = acessoManualEmVigor(
      associado.acessoManual,
      associado.acessoManualAte,
    );
    const plano = await planoAnualAte(
      this.prisma,
      associado.id,
      dataDaCompetencia(competenciaDaData(hojeEmMatoGrosso(new Date()))),
    );
    return {
      beneficios: await this.beneficios.listar(),
      consultoriaLiberada: podeAcessarRecursoRestrito(
        associado.situacao,
        manual,
      ),
      juridicaLiberada:
        manual === 'LIBERADO' || (plano !== null && manual !== 'BLOQUEADO'),
    };
  }

  /** O guarda de acesso já conferiu que o associado está em dia. */
  async enviar(usuarioId: string, dados: EnviarSuporteDto, agora = new Date()) {
    const associado = await this.associadoDe(usuarioId);
    await this.prisma.pedidoSuporte.create({
      data: {
        associadoId: associado.id,
        usuarioId,
        assunto: dados.assunto,
        mensagem: dados.mensagem,
        criadoEm: agora,
      },
    });
    void this.avisarSede(associado, dados);
    return { enviadoEm: agora.toISOString() };
  }

  /** Os sem resposta primeiro, do mais antigo ao mais novo. */
  async listar(): Promise<PedidoSuporte[]> {
    const pedidos = await this.prisma.pedidoSuporte.findMany({
      orderBy: [
        { respondidoEm: { sort: 'desc', nulls: 'first' } },
        { criadoEm: 'asc' },
      ],
      take: 200,
      select: CAMPOS,
    });
    return pedidos.map(paraPedido);
  }

  async marcarRespondido(
    usuarioId: string,
    id: string,
    agora = new Date(),
  ): Promise<PedidoSuporte> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.pedidoSuporte.updateMany({
        where: { id, respondidoEm: null },
        data: { respondidoEm: agora, respondidoPorId: usuarioId },
      });
      const pedido = await tx.pedidoSuporte.findUnique({
        where: { id },
        select: CAMPOS,
      });
      if (!pedido) throw new NotFoundException('Pedido não encontrado.');
      if (count === 0) {
        throw new ConflictException(
          'Este pedido já foi marcado como respondido.',
        );
      }
      await this.auditoria.registrar(tx, {
        usuarioId,
        acao: 'SUPORTE_RESPONDIDO',
        entidade: 'PedidoSuporte',
        entidadeId: id,
        associadoId: pedido.associado.id,
        valorAnterior: { respondido: false },
        valorNovo: { respondido: true, assunto: pedido.assunto },
      });
      return paraPedido(pedido);
    });
  }

  private async avisarSede(
    associado: {
      id: string;
      cnpj: string;
      razaoSocial: string;
      email: string | null;
    },
    dados: EnviarSuporteDto,
  ) {
    const web = this.config.get<string>('WEB_URL') ?? 'http://localhost:5173';
    const texto = [
      `${associado.razaoSocial} (CNPJ ${formatarCnpj(associado.cnpj)}) pediu suporte.`,
      '',
      `Assunto: ${dados.assunto}`,
      '',
      dados.mensagem,
      '',
      associado.email
        ? `Para responder, responda este e-mail: a resposta vai para ${associado.email}.`
        : 'A farmácia não tem e-mail no cadastro. Veja o telefone no perfil.',
      `Depois, marque o pedido como respondido: ${web.replace(/\/$/, '')}/admin/suporte`,
    ].join('\n');
    try {
      const usuarios = await this.prisma.usuario.findMany({
        where: { perfil: { in: ['ADMIN', 'ADMIN_BASICO'] }, ativo: true },
        select: { email: true },
      });
      for (const { email } of usuarios) {
        await this.email.send({
          to: email,
          subject: `Pedido de suporte: ${dados.assunto} - Elo Connect`,
          text: texto,
          ...(associado.email && { replyTo: associado.email }),
        });
      }
    } catch (erro) {
      this.logger.error(
        'Falha ao avisar a sede do pedido de suporte.',
        erro instanceof Error ? erro.stack : undefined,
      );
    }
  }

  private async associadoDe(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        associado: {
          select: {
            id: true,
            cnpj: true,
            razaoSocial: true,
            email: true,
            situacao: true,
            acessoManual: true,
            acessoManualAte: true,
          },
        },
      },
    });
    if (!usuario?.associado) {
      throw new NotFoundException('Associado não encontrado.');
    }
    return usuario.associado;
  }
}

function paraPedido(
  pedido: Prisma.PedidoSuporteGetPayload<{ select: typeof CAMPOS }>,
): PedidoSuporte {
  return {
    id: pedido.id,
    associado: pedido.associado,
    assunto: pedido.assunto,
    mensagem: pedido.mensagem,
    criadoEm: pedido.criadoEm.toISOString(),
    respondidoEm: pedido.respondidoEm?.toISOString() ?? null,
    respondidoPor: pedido.respondidoPor?.nome ?? null,
  };
}
