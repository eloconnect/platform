import { normalizarCnpj } from '@eloconnect/shared';
import type { Prisma } from '../generated/prisma/client.js';

/**
 * Busca por parte da razão social, do nome fantasia ou do CNPJ, com ou sem
 * pontuação. Usada na lista de associados (RF06) e no log de auditoria (RF40).
 */
export function buscaAssociado(texto: string): Prisma.AssociadoWhereInput {
  const cnpj = normalizarCnpj(texto);
  return {
    OR: [
      { razaoSocial: { contains: texto, mode: 'insensitive' } },
      { nomeFantasia: { contains: texto, mode: 'insensitive' } },
      ...(cnpj ? [{ cnpj: { contains: cnpj } }] : []),
    ],
  };
}
