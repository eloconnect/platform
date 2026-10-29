import { Injectable } from '@nestjs/common';
import type {
  ItemLogAuditoria,
  ListaLogAuditoria,
  UsuarioSede,
  ValorCampoLog,
} from '@eloconnect/shared';
import { buscaAssociado } from '../associados/busca-associado.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { FiltrosLogAuditoriaDto } from './dto/filtros-log-auditoria.dto.js';

const POR_PAGINA = 20;

/** Mato Grosso não tem horário de verão desde 2019: o fuso é sempre -04:00. */
const FUSO_SEDE = '-04:00';
const UM_DIA = 24 * 60 * 60 * 1000;

/** Meia-noite do dia (AAAA-MM-DD) no horário da sede. */
function inicioDoDia(dia: string): Date {
  return new Date(`${dia}T00:00:00${FUSO_SEDE}`);
}

/** Consulta do log de auditoria pela sede (US37, RF40). */
@Injectable()
export class ConsultaAuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ações da sede, da mais recente para a mais antiga, com filtros por
   * usuário, associado, ação e período, em páginas.
   */
  async listar({
    usuarioId,
    associado,
    acao,
    de,
    ate,
    pagina = 1,
  }: FiltrosLogAuditoriaDto): Promise<ListaLogAuditoria> {
    const texto = associado?.trim();
    const where: Prisma.LogAuditoriaWhereInput = {
      usuarioId,
      acao,
      ...(texto ? { associado: { is: buscaAssociado(texto) } } : {}),
      ...(de || ate
        ? {
            ocorridoEm: {
              ...(de ? { gte: inicioDoDia(de) } : {}),
              // O último dia entra inteiro: até a meia-noite do dia seguinte.
              ...(ate
                ? { lt: new Date(inicioDoDia(ate).getTime() + UM_DIA) }
                : {}),
            },
          }
        : {}),
    };

    const [total, linhas] = await this.prisma.$transaction([
      this.prisma.logAuditoria.count({ where }),
      this.prisma.logAuditoria.findMany({
        where,
        orderBy: [{ ocorridoEm: 'desc' }, { id: 'desc' }],
        skip: (pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
        select: {
          id: true,
          ocorridoEm: true,
          acao: true,
          valorAnterior: true,
          valorNovo: true,
          usuario: { select: { id: true, nome: true } },
          associado: { select: { id: true, cnpj: true, razaoSocial: true } },
        },
      }),
    ]);

    return {
      itens: linhas.map((linha): ItemLogAuditoria => ({
        ...linha,
        ocorridoEm: linha.ocorridoEm.toISOString(),
        valorAnterior: campos(linha.valorAnterior),
        valorNovo: campos(linha.valorNovo),
      })),
      total,
      pagina,
      porPagina: POR_PAGINA,
    };
  }

  /** Quem é ou já foi da sede, para o filtro por usuário. */
  usuarios(): Promise<UsuarioSede[]> {
    return this.prisma.usuario.findMany({
      where: { perfil: { in: ['ADMIN', 'ADMIN_BASICO'] } },
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
      select: { id: true, nome: true },
    });
  }
}

/**
 * O log guarda um objeto só com os campos que mudaram (ver `diferencas`). Um
 * valor que não seja texto, número ou sim/não vai como texto JSON.
 */
function campos(json: Prisma.JsonValue): Record<string, ValorCampoLog> | null {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return null;
  }
  const resultado: Record<string, ValorCampoLog> = {};
  for (const [campo, valor] of Object.entries(json)) {
    resultado[campo] =
      typeof valor === 'object' && valor !== null
        ? JSON.stringify(valor)
        : (valor ?? null);
  }
  return resultado;
}
