import { Injectable } from '@nestjs/common';
import type { AcaoAuditoria } from '@eloconnect/shared';
import type { Prisma } from '../generated/prisma/client.js';

/** Cliente do Prisma dentro de `prisma.$transaction(async (tx) => ...)`. */
export type Transacao = Prisma.TransactionClient;

export interface RegistroAuditoria {
  /** Usuário da sede que fez a ação (o `sub` do token). */
  usuarioId: string;
  acao: AcaoAuditoria;
  /** Nome do modelo afetado, ex.: 'Associado'. */
  entidade: string;
  entidadeId?: string;
  /** Preenchido quando a ação envolve um associado, para o filtro do RF40. */
  associadoId?: string;
  valorAnterior?: Prisma.InputJsonObject;
  valorNovo?: Prisma.InputJsonObject;
}

/**
 * Log de auditoria das ações da sede (RN26, RF39). O banco só aceita
 * inclusão nessa tabela: triggers recusam UPDATE e DELETE (RNF06).
 */
@Injectable()
export class AuditoriaService {
  /**
   * Grava uma ação no log. Recebe a transação da própria alteração, para que
   * a alteração e o registro entrem juntos, ou nenhum dos dois.
   */
  async registrar(tx: Transacao, registro: RegistroAuditoria): Promise<void> {
    await tx.logAuditoria.create({ data: registro });
  }
}

type ValorCampo = string | number | boolean | Date | null | undefined;
type ValorJson = string | number | boolean | null;

/**
 * Compara o registro antes e depois da alteração e devolve só os campos que
 * mudaram, no formato do log. Campo ausente em `depois` é campo que não mudou.
 * Retorna null quando nada mudou.
 */
export function diferencas(
  antes: Record<string, ValorCampo>,
  depois: Record<string, ValorCampo>,
): {
  valorAnterior: Prisma.InputJsonObject;
  valorNovo: Prisma.InputJsonObject;
} | null {
  const valorAnterior: Record<string, ValorJson> = {};
  const valorNovo: Record<string, ValorJson> = {};

  for (const [campo, novo] of Object.entries(depois)) {
    if (novo === undefined) continue;
    const anteriorJson = paraJson(antes[campo]);
    const novoJson = paraJson(novo);
    if (anteriorJson === novoJson) continue;
    valorAnterior[campo] = anteriorJson;
    valorNovo[campo] = novoJson;
  }

  return Object.keys(valorNovo).length > 0
    ? { valorAnterior, valorNovo }
    : null;
}

/** O log guarda JSON, então a data vira texto ISO. */
function paraJson(valor: ValorCampo): ValorJson {
  if (valor instanceof Date) return valor.toISOString();
  return valor ?? null;
}
