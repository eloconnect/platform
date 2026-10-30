import type { Readable } from 'node:stream';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Convencao, TipoAnexoConvencao } from '@eloconnect/shared';
import {
  acessoManualEmVigor,
  podeAcessarRecursoRestrito,
} from '@eloconnect/shared';
import {
  AuditoriaService,
  diferencas,
} from '../auditoria/auditoria.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CriarConvencaoDto,
  EditarConvencaoDto,
} from './dto/convencao.dto.js';
import {
  ArmazenamentoService,
  nomeOriginal,
} from '../armazenamento/armazenamento.service.js';

const TAMANHO_MAXIMO_PDF = 4 * 1024 * 1024;

const CAMPOS = {
  id: true,
  titulo: true,
  ano: true,
  resumo: true,
  publicadaEm: true,
  criadoEm: true,
  atualizadoEm: true,
  anexos: {
    select: {
      id: true,
      tipo: true,
      nomeArquivo: true,
      tamanhoBytes: true,
    },
  },
} satisfies Prisma.ConvencaoSelect;

const ENTIDADE = 'Convencao';

const TIPOS_ANEXO = ['INTEGRAL', 'RESUMIDA'] as const;

interface ArquivoPdf {
  mimetype: string;
  buffer: Buffer;
  size: number;
  originalname: string;
}

type ArquivosConvencao = {
  integral?: ArquivoPdf;
  resumida?: ArquivoPdf;
};

@Injectable()
export class ConvencoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly armazenamento: ArmazenamentoService,
  ) {}

  /**
   * Lista convenções para a administração, incluindo rascunhos.
   */
  async listar(): Promise<Convencao[]> {
    const convencoes = await this.prisma.convencao.findMany({
      orderBy: [{ ano: 'desc' }, { criadoEm: 'desc' }, { id: 'desc' }],
      select: CAMPOS,
    });

    return convencoes.map(paraConvencao);
  }

  /**
   * Lista convenções publicadas somente para associados ativos.
   */
  async listarParaAssociado(usuarioId: string): Promise<Convencao[]> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        ativo: true,
        perfil: true,
        associado: {
          select: {
            inativadoEm: true,
          },
        },
      },
    });

    if (
      !usuario ||
      !usuario.ativo ||
      usuario.perfil !== 'ASSOCIADO' ||
      !usuario.associado ||
      usuario.associado.inativadoEm !== null
    ) {
      throw new ForbiddenException(
        'Acesso disponível somente para associados ativos.',
      );
    }

    const convencoes = await this.prisma.convencao.findMany({
      where: {
        publicadaEm: { not: null },
      },
      orderBy: [{ ano: 'desc' }, { publicadaEm: 'desc' }, { id: 'desc' }],
      select: CAMPOS,
    });

    return convencoes.map(paraConvencao);
  }

  /**
   * Obtém um PDF de convenção para um associado autenticado.
   *
   * O PDF integral exige acesso financeiro autorizado.
   * Caso o associado não tenha essa autorização, uma solicitação
   * do documento integral retorna o PDF resumido.
   */
  async obterAnexoAssociado(
    usuarioId: string,
    convencaoId: string,
    tipoSolicitado: TipoAnexoConvencao,
  ): Promise<{
    stream: Readable;
    contentType: string;
    nomeArquivo: string;
  }> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        ativo: true,
        perfil: true,
        associado: {
          select: {
            situacao: true,
            acessoManual: true,
            acessoManualAte: true,
            inativadoEm: true,
          },
        },
      },
    });

    if (!usuario || !usuario.ativo) {
      throw new ForbiddenException('Usuário inativo ou não encontrado.');
    }

    if (usuario.perfil !== 'ASSOCIADO' || !usuario.associado) {
      throw new ForbiddenException(
        'Esta operação está disponível somente para associados.',
      );
    }

    if (usuario.associado.inativadoEm !== null) {
      throw new ForbiddenException('O acesso deste associado está inativado.');
    }

    const acessoManual = acessoManualEmVigor(
      usuario.associado.acessoManual,
      usuario.associado.acessoManualAte,
    );

    const podeAcessarIntegral = podeAcessarRecursoRestrito(
      usuario.associado.situacao,
      acessoManual,
    );

    const tipoEfetivo: TipoAnexoConvencao =
      tipoSolicitado === 'INTEGRAL' && !podeAcessarIntegral
        ? 'RESUMIDA'
        : tipoSolicitado;

    return this.abrirAnexo(convencaoId, tipoEfetivo, true);
  }

  /**
   * Obtém um PDF para a sede conferir, inclusive de rascunho.
   */
  obterAnexoSede(
    convencaoId: string,
    tipo: TipoAnexoConvencao,
  ): Promise<{
    stream: Readable;
    contentType: string;
    nomeArquivo: string;
  }> {
    return this.abrirAnexo(convencaoId, tipo, false);
  }

  private async abrirAnexo(
    convencaoId: string,
    tipo: TipoAnexoConvencao,
    somentePublicada: boolean,
  ): Promise<{
    stream: Readable;
    contentType: string;
    nomeArquivo: string;
  }> {
    const convencao = await this.prisma.convencao.findFirst({
      where: {
        id: convencaoId,
        ...(somentePublicada ? { publicadaEm: { not: null } } : {}),
      },
      select: {
        id: true,
        anexos: {
          where: { tipo },
          select: {
            nomeArquivo: true,
            arquivoUrl: true,
          },
          take: 1,
        },
      },
    });

    if (!convencao) {
      throw new NotFoundException(
        somentePublicada
          ? 'Convenção publicada não encontrada.'
          : 'Convenção não encontrada.',
      );
    }

    const anexo = convencao.anexos[0];

    if (!anexo) {
      throw new NotFoundException(
        'O PDF solicitado não está disponível para esta convenção.',
      );
    }

    const arquivo = await this.armazenamento.obter(anexo.arquivoUrl);

    if (!arquivo) {
      throw new NotFoundException(
        'O arquivo PDF não foi encontrado no armazenamento.',
      );
    }

    return {
      stream: arquivo.stream,
      contentType: arquivo.contentType,
      nomeArquivo:
        tipo === 'INTEGRAL'
          ? 'convencao-integral.pdf'
          : 'convencao-resumida.pdf',
    };
  }

  /**
   * Cria uma convenção como rascunho.
   * A publicação acontece separadamente.
   */
  async criar(usuarioId: string, dados: CriarConvencaoDto): Promise<Convencao> {
    const { titulo, ano, resumo } = dados;

    return this.prisma.$transaction(async (tx) => {
      const convencao = await tx.convencao.create({
        data: {
          titulo,
          ano,
          resumo,
          autorId: usuarioId,
        },
        select: CAMPOS,
      });

      await this.auditoria.registrar(tx, {
        usuarioId,
        acao: 'CONVENCAO_CRIADA',
        entidade: ENTIDADE,
        entidadeId: convencao.id,
        valorNovo: { titulo, ano, resumo },
      });

      return paraConvencao(convencao);
    });
  }

  /**
   * Edita os campos enviados, sem alterar os campos omitidos.
   */
  async editar(
    usuarioId: string,
    id: string,
    dados: EditarConvencaoDto,
  ): Promise<Convencao> {
    const { titulo, ano, resumo } = dados;
    const alteracoes = { titulo, ano, resumo };

    return this.prisma.$transaction(async (tx) => {
      const antes = await this.buscar(tx, id);

      const convencao = await tx.convencao.update({
        where: { id },
        data: alteracoes,
        select: CAMPOS,
      });

      const mudanca = diferencas(
        {
          titulo: antes.titulo,
          ano: antes.ano,
          resumo: antes.resumo,
        },
        alteracoes,
      );

      if (mudanca) {
        await this.auditoria.registrar(tx, {
          usuarioId,
          acao: 'CONVENCAO_EDITADA',
          entidade: ENTIDADE,
          entidadeId: id,
          ...mudanca,
        });
      }

      return paraConvencao(convencao);
    });
  }

  /**
   * Envia ou substitui os PDFs integral e resumido.
   *
   * O banco guarda os metadados e o caminho interno do Blob.
   * O caminho interno nunca é devolvido ao frontend.
   */
  async atualizarAnexos(
    usuarioId: string,
    id: string,
    arquivos: ArquivosConvencao,
  ): Promise<Convencao> {
    const enviados = [
      { tipo: 'INTEGRAL' as const, arquivo: arquivos.integral },
      { tipo: 'RESUMIDA' as const, arquivo: arquivos.resumida },
    ].filter(
      (
        item,
      ): item is {
        tipo: 'INTEGRAL' | 'RESUMIDA';
        arquivo: ArquivoPdf;
      } => item.arquivo !== undefined,
    );

    if (enviados.length === 0) {
      throw new BadRequestException(
        'Envie pelo menos um PDF: integral ou resumido.',
      );
    }

    for (const { arquivo } of enviados) {
      this.validarPdf(arquivo);
    }

    const existente = await this.prisma.convencao.findUnique({
      where: { id },
      select: {
        id: true,
        anexos: {
          select: {
            tipo: true,
            nomeArquivo: true,
            arquivoUrl: true,
            tamanhoBytes: true,
          },
        },
      },
    });

    if (!existente) {
      throw new NotFoundException('Convenção não encontrada.');
    }

    const tiposEnviados = new Set(enviados.map((item) => item.tipo));

    for (const tipo of TIPOS_ANEXO) {
      const jaExiste = existente.anexos.some((anexo) => anexo.tipo === tipo);

      if (!jaExiste && !tiposEnviados.has(tipo)) {
        throw new BadRequestException(
          'A convenção precisa ter os PDFs integral e resumido.',
        );
      }
    }

    const novosCaminhos: string[] = [];

    try {
      const novosAnexos = await Promise.all(
        enviados.map(async ({ tipo, arquivo }) => {
          const nomeArquivo =
            tipo === 'INTEGRAL'
              ? 'convencao-integral.pdf'
              : 'convencao-resumida.pdf';

          const caminho = await this.armazenamento.salvar(
            `convencoes/${id}/${nomeArquivo}`,
            arquivo.buffer,
          );

          novosCaminhos.push(caminho);

          return {
            tipo,
            nomeArquivo,
            arquivoUrl: caminho,
            tamanhoBytes: arquivo.size,
          };
        }),
      );

      const convencao = await this.prisma.$transaction(async (tx) => {
        await this.buscar(tx, id);

        for (const anexo of novosAnexos) {
          await tx.convencaoAnexo.deleteMany({
            where: {
              convencaoId: id,
              tipo: anexo.tipo,
            },
          });

          await tx.convencaoAnexo.create({
            data: {
              convencaoId: id,
              tipo: anexo.tipo,
              nomeArquivo: anexo.nomeArquivo,
              arquivoUrl: anexo.arquivoUrl,
              tamanhoBytes: anexo.tamanhoBytes,
            },
          });
        }

        const resultado = await tx.convencao.findUniqueOrThrow({
          where: { id },
          select: CAMPOS,
        });

        await this.auditoria.registrar(tx, {
          usuarioId,
          acao: 'CONVENCAO_ANEXOS_ATUALIZADOS',
          entidade: ENTIDADE,
          entidadeId: id,
          // Um campo por PDF, com o nome do arquivo que a sede enviou.
          valorNovo: Object.fromEntries(
            enviados.map(({ tipo, arquivo }) => [
              tipo === 'INTEGRAL' ? 'pdfIntegral' : 'pdfResumido',
              nomeOriginal(arquivo.originalname, 'arquivo.pdf'),
            ]),
          ),
        });

        return resultado;
      });

      const caminhosAntigos = existente.anexos
        .filter((anexo) => tiposEnviados.has(anexo.tipo))
        .map((anexo) => anexo.arquivoUrl);

      await Promise.allSettled(
        caminhosAntigos.map((caminho) => this.armazenamento.excluir(caminho)),
      );

      return paraConvencao(convencao);
    } catch (erro) {
      await Promise.allSettled(
        novosCaminhos.map((caminho) => this.armazenamento.excluir(caminho)),
      );

      throw erro;
    }
  }

  /**
   * Publica a convenção. Só publica com os PDFs integral e resumido (RN12).
   */
  async publicar(usuarioId: string, id: string): Promise<Convencao> {
    return this.prisma.$transaction(async (tx) => {
      const antes = await this.buscar(tx, id);

      if (antes.publicadaEm) {
        throw new BadRequestException('A convenção já está publicada.');
      }

      const faltaPdf = TIPOS_ANEXO.some(
        (tipo) => !antes.anexos.some((anexo) => anexo.tipo === tipo),
      );

      if (faltaPdf) {
        throw new BadRequestException(
          'Envie o PDF integral e o resumido antes de publicar.',
        );
      }

      const convencao = await tx.convencao.update({
        where: { id },
        data: { publicadaEm: new Date() },
        select: CAMPOS,
      });

      await this.auditoria.registrar(tx, {
        usuarioId,
        acao: 'CONVENCAO_PUBLICADA',
        entidade: ENTIDADE,
        entidadeId: id,
        valorAnterior: { publicadaEm: null },
        valorNovo: {
          publicadaEm: convencao.publicadaEm?.toISOString() ?? null,
        },
      });

      return paraConvencao(convencao);
    });
  }

  /**
   * Valida o tamanho, o tipo MIME e a assinatura do arquivo PDF.
   */
  private validarPdf(arquivo: ArquivoPdf): void {
    if (arquivo.size > TAMANHO_MAXIMO_PDF) {
      throw new BadRequestException('Cada PDF pode ter no máximo 4 MB.');
    }

    if (
      arquivo.mimetype !== 'application/pdf' ||
      !arquivo.buffer ||
      arquivo.buffer.length < 5 ||
      arquivo.buffer.subarray(0, 5).toString('ascii') !== '%PDF-'
    ) {
      throw new BadRequestException(
        'Arquivo inválido. Envie um documento PDF válido.',
      );
    }
  }

  /**
   * Busca os dados básicos de uma convenção dentro de uma transação.
   */
  private async buscar(tx: Prisma.TransactionClient, id: string) {
    const convencao = await tx.convencao.findUnique({
      where: { id },
      select: {
        id: true,
        titulo: true,
        ano: true,
        resumo: true,
        publicadaEm: true,
        anexos: { select: { tipo: true } },
      },
    });

    if (!convencao) {
      throw new NotFoundException('Convenção não encontrada.');
    }

    return convencao;
  }
}

/**
 * Converte as datas para ISO e mantém apenas os metadados dos PDFs.
 * Nunca retorna o caminho interno do armazenamento.
 */
function paraConvencao(
  convencao: Prisma.ConvencaoGetPayload<{
    select: typeof CAMPOS;
  }>,
): Convencao {
  return {
    id: convencao.id,
    titulo: convencao.titulo,
    ano: convencao.ano,
    resumo: convencao.resumo,
    publicadaEm: convencao.publicadaEm?.toISOString() ?? null,
    criadoEm: convencao.criadoEm.toISOString(),
    atualizadoEm: convencao.atualizadoEm.toISOString(),
    anexos: convencao.anexos,
  };
}
