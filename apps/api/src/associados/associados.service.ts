import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditoriaService,
  diferencas,
} from '../auditoria/auditoria.service.js';
import {
  acessoManualEmVigor,
  DIAS_LIBERACAO_MANUAL,
  formatarDia,
  podeAcessarRecursoRestrito,
  textoSituacao,
  type AcaoAuditoria,
  type InterrupcaoCobranca,
  type MinhaConta,
  type StatusAssociado,
} from '@eloconnect/shared';
import { EdicaoBoletoService } from '../cobranca/edicao-boleto.service.js';
import { hojeEmMatoGrosso, textoDia } from '../cobranca/valor-do-mes.js';
import { EmailService } from '../email/email.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CriarAssociadoDto,
  DefinirAcessoDto,
  EditarAssociadoDto,
} from './dto/associado.dto.js';
import { buscaAssociado } from './busca-associado.js';
import type { FiltrosAssociadosDto } from './dto/filtros-associados.dto.js';

/** Campos que a API devolve para a sede. */
const CAMPOS = {
  id: true,
  cnpj: true,
  razaoSocial: true,
  nomeFantasia: true,
  email: true,
  telefone: true,
  municipio: true,
  contribuicaoAtiva: true,
  situacao: true,
  acessoManual: true,
  acessoManualAte: true,
  inativadoEm: true,
  criadoEm: true,
  atualizadoEm: true,
} satisfies Prisma.AssociadoSelect;

const ENTIDADE = 'Associado';
const POR_PAGINA = 20;
const UM_DIA = 24 * 60 * 60 * 1000;
/** Quem estava em dia mantém o acesso por mais 30 dias (RN25). */
const DIAS_ACESSO_APOS_INTERRUPCAO = 30;

/**
 * Último dia com acesso depois da interrupção ("AAAA-MM-DD"): o dia da
 * interrupção, no horário de Mato Grosso, mais 30 dias.
 */
function ultimoDiaComAcesso(interrompidaEm: Date): string {
  const dia = hojeEmMatoGrosso(interrompidaEm);
  return textoDia(
    new Date(dia.getTime() + DIAS_ACESSO_APOS_INTERRUPCAO * UM_DIA),
  );
}

/**
 * A interrupção da cobrança, enquanto ela não foi desfeita. Sem anotar o
 * retorno: no lint do CI, que roda sem o shared compilado, um tipo do shared
 * numa união vira erro.
 */
function interrupcao(associado: {
  contribuicaoAtiva: boolean;
  cobrancaInterrompidaEm: Date | null;
}) {
  if (associado.contribuicaoAtiva || !associado.cobrancaInterrompidaEm) {
    return null;
  }
  return {
    interrompidaEm: associado.cobrancaInterrompidaEm.toISOString(),
    acessoAte: ultimoDiaComAcesso(associado.cobrancaInterrompidaEm),
  } satisfies InterrupcaoCobranca;
}

/** Como cada opção do filtro de status vira condição no banco (RN22). */
const FILTRO_STATUS: Record<StatusAssociado, Prisma.AssociadoWhereInput> = {
  ADIMPLENTE: { situacao: 'ADIMPLENTE' },
  INADIMPLENTE: { situacao: 'INADIMPLENTE', contribuicaoAtiva: true },
  SEM_CONTRIBUICAO: { situacao: 'INADIMPLENTE', contribuicaoAtiva: false },
  CANCELAMENTO_SOLICITADO: { cancelamentos: { some: { status: 'PENDENTE' } } },
};

interface TrocaDeEmail {
  anterior: string;
  novo: string;
  /** A conta já tem senha; senão, o associado ainda precisa criar a senha. */
  contaConfirmada: boolean;
}

/** Ação do log para cada decisão sobre o acesso (RN11). */
const ACAO_ACESSO = {
  BLOQUEADO: 'ACESSO_BLOQUEADO',
  LIBERADO: 'ACESSO_LIBERADO',
  AUTOMATICO: 'ACESSO_AUTOMATICO',
} satisfies Record<string, AcaoAuditoria>;

/**
 * Lista, cadastro, edição, inativação e acesso manual dos associados pela
 * sede (RF06, RF08, RF09).
 */
@Injectable()
export class AssociadosService {
  private readonly logger = new Logger(AssociadosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly email: EmailService,
    private readonly edicoes: EdicaoBoletoService,
  ) {}

  /**
   * Lista com busca por nome ou CNPJ, filtros e páginas (RF06). Os
   * inativados ficam de fora, a menos que sejam pedidos.
   */
  async listar({
    busca,
    status,
    contribuicaoAtiva,
    incluirInativos,
    pagina = 1,
  }: FiltrosAssociadosDto) {
    const texto = busca?.trim();
    const where: Prisma.AssociadoWhereInput = {
      ...(incluirInativos ? {} : { inativadoEm: null }),
      // AND, para o filtro de status não apagar o de "Recebe boleto mensal".
      AND: [
        contribuicaoAtiva === undefined ? {} : { contribuicaoAtiva },
        status ? FILTRO_STATUS[status] : {},
      ],
      ...(texto ? buscaAssociado(texto) : {}),
    };

    const [total, linhas] = await this.prisma.$transaction([
      this.prisma.associado.count({ where }),
      this.prisma.associado.findMany({
        where,
        orderBy: [{ razaoSocial: 'asc' }, { id: 'asc' }],
        skip: (pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
        select: {
          id: true,
          cnpj: true,
          razaoSocial: true,
          nomeFantasia: true,
          situacao: true,
          acessoManual: true,
          acessoManualAte: true,
          contribuicaoAtiva: true,
          inativadoEm: true,
          _count: {
            select: { cancelamentos: { where: { status: 'PENDENTE' } } },
          },
        },
      }),
    ]);

    return {
      itens: linhas.map(({ _count, ...linha }) => ({
        ...linha,
        cancelamentoSolicitado: _count.cancelamentos > 0,
      })),
      total,
      pagina,
      porPagina: POR_PAGINA,
    };
  }

  /**
   * Perfil do associado, com as solicitações de cancelamento, a conta de
   * acesso (RF07) e o boleto do mês seguinte (RF11).
   */
  async buscar(id: string) {
    const associado = await this.prisma.associado.findUnique({
      where: { id },
      select: {
        ...CAMPOS,
        cobrancaInterrompidaEm: true,
        usuario: {
          select: { email: true, criadoEm: true, emailConfirmadoEm: true },
        },
        cancelamentos: {
          orderBy: { solicitadaEm: 'desc' },
          select: {
            id: true,
            status: true,
            motivo: true,
            observacaoSede: true,
            solicitadaEm: true,
            decididaEm: true,
            decididaPor: { select: { nome: true } },
          },
        },
      },
    });
    if (!associado) {
      throw new NotFoundException('Associado não encontrado.');
    }
    const { usuario, cobrancaInterrompidaEm, ...dados } = associado;
    return {
      ...dados,
      interrupcaoCobranca: interrupcao({
        contribuicaoAtiva: associado.contribuicaoAtiva,
        cobrancaInterrompidaEm,
      }),
      conta: usuario && {
        email: usuario.email,
        criadaEm: usuario.criadoEm,
        confirmadaEm: usuario.emailConfirmadoEm,
      },
      proximoBoleto: await this.edicoes.proximoBoleto(associado),
    };
  }

  async criar(usuarioId: string, dados: CriarAssociadoDto) {
    // Objeto simples com os campos enviados, para o log.
    const { ...enviados } = dados;
    return this.comCnpjUnico(() =>
      this.prisma.$transaction(async (tx) => {
        const associado = await tx.associado.create({
          data: dados,
          select: CAMPOS,
        });
        await this.auditoria.registrar(tx, {
          usuarioId,
          acao: 'ASSOCIADO_CRIADO',
          entidade: ENTIDADE,
          entidadeId: associado.id,
          associadoId: associado.id,
          valorNovo: diferencas({}, enviados)?.valorNovo,
        });
        return associado;
      }),
    );
  }

  /**
   * Edita os dados e a contribuição ativa. A mudança na contribuição ativa
   * ("Recebe boleto mensal") gera uma ação própria no log (RN25, RN26).
   */
  /**
   * Edição do cadastro. O e-mail do cadastro é o mesmo da conta de acesso
   * (RN34): se o associado tem conta, trocar o e-mail troca também o login,
   * invalida os links de senha já enviados e avisa os dois endereços.
   */
  async editar(usuarioId: string, id: string, dados: EditarAssociadoDto) {
    const { associado, trocaDeEmail } = await this.comCnpjUnico(() =>
      this.prisma.$transaction(async (tx) => {
        const antes = await tx.associado.findUnique({ where: { id } });
        if (!antes) {
          throw new NotFoundException('Associado não encontrado.');
        }
        // Interromper tem ação própria, com motivo, aviso e os 30 dias de
        // acesso (RN25).
        if (antes.contribuicaoAtiva && dados.contribuicaoAtiva === false) {
          throw new BadRequestException({
            message:
              'Para interromper a cobrança mensal, use "Interromper a cobrança mensal" no perfil do associado.',
            campo: 'contribuicaoAtiva',
          });
        }
        const trocaDeEmail = await this.trocarEmailDaConta(
          tx,
          usuarioId,
          id,
          dados.email,
        );
        // Ativada de novo, a interrupção deixa de valer.
        if (dados.contribuicaoAtiva && antes.cobrancaInterrompidaEm) {
          await tx.associado.update({
            where: { id },
            data: { cobrancaInterrompidaEm: null },
          });
        }
        const associado = await tx.associado.update({
          where: { id },
          data: dados,
          select: CAMPOS,
        });

        const { contribuicaoAtiva, ...cadastro } = dados;
        const mudancaCadastro = diferencas(antes, cadastro);
        if (mudancaCadastro) {
          await this.auditoria.registrar(tx, {
            usuarioId,
            acao: 'ASSOCIADO_EDITADO',
            entidade: ENTIDADE,
            entidadeId: id,
            associadoId: id,
            ...mudancaCadastro,
          });
        }
        const mudancaContribuicao = diferencas(antes, { contribuicaoAtiva });
        if (mudancaContribuicao) {
          await this.auditoria.registrar(tx, {
            usuarioId,
            acao: contribuicaoAtiva
              ? 'CONTRIBUICAO_ATIVADA'
              : 'CONTRIBUICAO_INTERROMPIDA',
            entidade: ENTIDADE,
            entidadeId: id,
            associadoId: id,
            ...mudancaContribuicao,
          });
        }
        return { associado, trocaDeEmail };
      }),
    );
    if (trocaDeEmail) {
      this.avisarTrocaDeEmail(
        associado.nomeFantasia ?? associado.razaoSocial,
        trocaDeEmail,
      );
    }
    return associado;
  }

  /**
   * Leva o e-mail novo do cadastro para a conta de acesso, se houver (RN34).
   * Devolve a troca feita, para o aviso por e-mail depois da transação.
   */
  private async trocarEmailDaConta(
    tx: Prisma.TransactionClient,
    usuarioId: string,
    associadoId: string,
    email: string | null | undefined,
  ): Promise<TrocaDeEmail | null> {
    if (email === undefined) return null;
    const conta = await tx.usuario.findUnique({
      where: { associadoId },
      select: { id: true, email: true, emailConfirmadoEm: true },
    });
    if (!conta) return null;
    if (!email) {
      throw new BadRequestException({
        message:
          'O associado tem conta de acesso: o e-mail não pode ficar vazio.',
        campo: 'email',
      });
    }
    const novo = email.toLowerCase();
    if (novo === conta.email) return null;
    const outraConta = await tx.usuario.findUnique({
      where: { email: novo },
      select: { id: true },
    });
    if (outraConta) {
      throw new ConflictException({
        message: 'Este e-mail já é usado na conta de outra farmácia.',
        campo: 'email',
      });
    }
    await tx.usuario.update({ where: { id: conta.id }, data: { email: novo } });
    // Os links de senha mandados para o e-mail antigo deixam de valer.
    await tx.tokenUsuario.updateMany({
      where: { usuarioId: conta.id, usadoEm: null },
      data: { usadoEm: new Date() },
    });
    await this.auditoria.registrar(tx, {
      usuarioId,
      acao: 'CONTA_EMAIL_ALTERADO',
      entidade: 'Usuario',
      entidadeId: conta.id,
      associadoId,
      valorAnterior: { email: conta.email },
      valorNovo: { email: novo },
    });
    return {
      anterior: conta.email,
      novo,
      contaConfirmada: conta.emailConfirmadoEm !== null,
    };
  }

  /** Não aguarda o envio: a troca já foi gravada, e o aviso não pode desfazê-la. */
  private avisarTrocaDeEmail(nome: string, troca: TrocaDeEmail) {
    const mensagens = [
      {
        to: troca.novo,
        subject: 'Seu e-mail de acesso mudou - Elo Connect',
        text: [
          `Olá, ${nome}.`,
          '',
          'A sede do sindicato trocou o e-mail de acesso da sua farmácia no Elo Connect para este endereço.',
          troca.contaConfirmada
            ? `A partir de agora, entre com ${troca.novo} e a sua senha. Se não lembra a senha, use "Esqueci minha senha" na tela de entrar.`
            : 'Para criar a sua senha, use "Criar conta" na página inicial, com o CNPJ da farmácia.',
        ].join('\n'),
      },
      {
        to: troca.anterior,
        subject: 'Seu e-mail de acesso mudou - Elo Connect',
        text: [
          `Olá, ${nome}.`,
          '',
          'A sede do sindicato trocou o e-mail de acesso da sua farmácia no Elo Connect. Este endereço não entra mais na conta.',
          'Se você não pediu essa troca, fale com a sede do sindicato.',
        ].join('\n'),
      },
    ];
    for (const mensagem of mensagens) {
      void this.email.send(mensagem).catch((error: unknown) => {
        this.logger.error(
          'Falha ao enviar o aviso de troca de e-mail.',
          error instanceof Error ? error.stack : undefined,
        );
      });
    }
  }

  /**
   * Inativa o associado (RF08); não há exclusão.
   * TODO(P13): o que a inativação muda na conta de acesso e na cobrança
   * recorrente depende da resposta do cliente.
   */
  async inativar(usuarioId: string, id: string) {
    return this.definirInativacao(usuarioId, id, new Date());
  }

  /**
   * Bloqueia, libera ou devolve ao automático o acesso a benefícios e suporte
   * (RF09, RN11). A decisão da sede prevalece sobre a situação automática, e
   * os jobs de cobrança não a mudam. A liberação vale 7 dias; o bloqueio, até
   * a sede mudar. O motivo fica só no log de auditoria.
   */
  async definirAcesso(
    usuarioId: string,
    id: string,
    { acessoManual, motivo }: DefinirAcessoDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const antes = await tx.associado.findUnique({ where: { id } });
      if (!antes) {
        throw new NotFoundException('Associado não encontrado.');
      }
      const acessoManualAte =
        acessoManual === 'LIBERADO'
          ? new Date(Date.now() + DIAS_LIBERACAO_MANUAL * 24 * 60 * 60 * 1000)
          : null;
      const mudanca = diferencas(antes, { acessoManual, acessoManualAte });
      // Já está como pedido: nada muda e nada vai para o log.
      if (!mudanca) {
        return tx.associado.findUniqueOrThrow({
          where: { id },
          select: CAMPOS,
        });
      }
      const associado = await tx.associado.update({
        where: { id },
        data: { acessoManual, acessoManualAte },
        select: CAMPOS,
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        acao: ACAO_ACESSO[acessoManual ?? 'AUTOMATICO'],
        entidade: ENTIDADE,
        entidadeId: id,
        associadoId: id,
        valorAnterior: mudanca.valorAnterior,
        valorNovo: { ...mudanca.valorNovo, motivo },
      });
      return associado;
    });
  }

  /**
   * Interrompe a cobrança recorrente (US35: RF38, RN25). O associado deixa de
   * receber o boleto mensal e os lembretes e recebe um aviso por e-mail. Quem
   * estava em dia mantém o acesso por mais 30 dias, e depois o bloqueio
   * automático o torna inadimplente. Os boletos já emitidos continuam valendo.
   */
  async interromperCobranca(
    usuarioId: string,
    id: string,
    motivo: string,
    agora = new Date(),
  ) {
    const associado = await this.prisma.$transaction(async (tx) => {
      const antes = await tx.associado.findUnique({ where: { id } });
      if (!antes) {
        throw new NotFoundException('Associado não encontrado.');
      }
      if (!antes.contribuicaoAtiva) {
        throw new BadRequestException(
          'Este associado não recebe o boleto mensal.',
        );
      }
      await tx.associado.update({
        where: { id },
        data: { contribuicaoAtiva: false, cobrancaInterrompidaEm: agora },
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        acao: 'CONTRIBUICAO_INTERROMPIDA',
        entidade: ENTIDADE,
        entidadeId: id,
        associadoId: id,
        valorAnterior: { contribuicaoAtiva: true },
        valorNovo: { contribuicaoAtiva: false, motivo },
      });
      return antes;
    });

    if (associado.email) {
      const comAcesso = podeAcessarRecursoRestrito(
        associado.situacao,
        acessoManualEmVigor(associado.acessoManual, associado.acessoManualAte),
      );
      void this.email
        .send({
          to: associado.email,
          subject: 'A cobrança mensal foi interrompida - Elo Connect',
          text: [
            `Olá, ${associado.nomeFantasia ?? associado.razaoSocial}.`,
            '',
            'A sede do sindicato interrompeu a cobrança mensal da sua contribuição. Você não vai mais receber o boleto todo mês.',
            ...(comAcesso
              ? [
                  '',
                  `O seu acesso a benefícios e suporte continua até ${formatarDia(ultimoDiaComAcesso(agora))}.`,
                ]
              : []),
            '',
            'Se tiver dúvidas, fale com a sede do sindicato.',
          ].join('\n'),
        })
        .catch((error: unknown) => {
          this.logger.error(
            'Falha ao enviar o aviso de interrupção da cobrança.',
            error instanceof Error ? error.stack : undefined,
          );
        });
    }
    return this.buscar(id);
  }

  /**
   * O que o associado vê na área dele: a situação e, se a sede liberou o
   * acesso, até quando a liberação vale (RN11, RN22).
   */
  async minhaConta(usuarioId: string): Promise<MinhaConta> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        associado: {
          select: {
            razaoSocial: true,
            nomeFantasia: true,
            situacao: true,
            contribuicaoAtiva: true,
            acessoManual: true,
            acessoManualAte: true,
          },
        },
      },
    });
    const associado = usuario?.associado;
    if (!associado) {
      throw new NotFoundException('Associado não encontrado.');
    }
    const liberado =
      acessoManualEmVigor(associado.acessoManual, associado.acessoManualAte) ===
      'LIBERADO';
    return {
      nome: associado.nomeFantasia ?? associado.razaoSocial,
      situacao: textoSituacao(associado),
      acessoLiberadoAte: liberado
        ? (associado.acessoManualAte?.toISOString() ?? null)
        : null,
      recebeBoletoMensal: associado.contribuicaoAtiva,
    };
  }

  /** Desfaz a inativação. [A confirmar] com o cliente (P13). */
  async reativar(usuarioId: string, id: string) {
    return this.definirInativacao(usuarioId, id, null);
  }

  private async definirInativacao(
    usuarioId: string,
    id: string,
    inativadoEm: Date | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const antes = await tx.associado.findUnique({ where: { id } });
      if (!antes) {
        throw new NotFoundException('Associado não encontrado.');
      }
      // Já está como pedido: nada muda e nada vai para o log.
      if ((antes.inativadoEm === null) === (inativadoEm === null)) {
        return tx.associado.findUniqueOrThrow({
          where: { id },
          select: CAMPOS,
        });
      }
      const associado = await tx.associado.update({
        where: { id },
        data: { inativadoEm },
        select: CAMPOS,
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        acao: inativadoEm ? 'ASSOCIADO_INATIVADO' : 'ASSOCIADO_REATIVADO',
        entidade: ENTIDADE,
        entidadeId: id,
        associadoId: id,
        ...diferencas(antes, { inativadoEm }),
      });
      return associado;
    });
  }

  /** Troca o erro de CNPJ repetido do banco por uma mensagem para a sede. */
  private async comCnpjUnico<T>(operacao: () => Promise<T>): Promise<T> {
    try {
      return await operacao();
    } catch (erro) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um associado com este CNPJ.');
      }
      throw erro;
    }
  }
}
