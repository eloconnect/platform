import type { ResultadoJucemat } from '@eloconnect/shared';
import { Injectable } from '@nestjs/common';
import {
  AuditoriaService,
  diferencas,
} from '../auditoria/auditoria.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { lerXmlJucemat, type EmpresaJucemat } from './jucemat.js';

/** Campos que a JUCEMAT completa quando estão vazios no cadastro. */
const COMPLETAVEIS = [
  'nomeFantasia',
  'email',
  'telefone',
  'municipio',
] as const;

/**
 * Importação do arquivo da JUCEMAT (US28: RF28), que traz as farmácias de MT
 * com o e-mail (resposta 40). Decisões do grupo, com aval do cliente (P02,
 * 24/11/2026), até chegar o layout real:
 * - a farmácia nova entra no cadastro sem receber o boleto mensal, e assim
 *   passa a receber a cobrança formal (RN19);
 * - a farmácia que já está no cadastro só ganha os dados que faltam: o que a
 *   sede digitou nunca é trocado, para não mudar o e-mail de acesso de quem
 *   tem conta (RN34) sem a sede saber;
 * - não é tudo ou nada: a empresa com problema fica de fora, e o resto entra;
 * - cada farmácia nova ou completada fica no log de auditoria (RN26).
 */
@Injectable()
export class JucematService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async importar(usuarioId: string, texto: string): Promise<ResultadoJucemat> {
    const { empresas, erros } = lerXmlJucemat(texto);
    if (empresas.length === 0) {
      return { novas: 0, completadas: 0, semMudanca: 0, erros };
    }

    return this.prisma.$transaction(
      async (tx) => {
        const existentes = new Map(
          (
            await tx.associado.findMany({
              where: { cnpj: { in: empresas.map(({ cnpj }) => cnpj) } },
              select: {
                id: true,
                cnpj: true,
                nomeFantasia: true,
                email: true,
                telefone: true,
                municipio: true,
              },
            })
          ).map((associado) => [associado.cnpj, associado]),
        );

        const novas = empresas.filter(({ cnpj }) => !existentes.has(cnpj));
        const criadas = await tx.associado.createManyAndReturn({
          data: novas.map(({ empresa: _empresa, ...dados }) => dados),
          // Dois envios juntos: o segundo pula o que o primeiro criou.
          skipDuplicates: true,
          select: { id: true, cnpj: true },
        });
        const idDoCnpj = new Map(criadas.map(({ id, cnpj }) => [cnpj, id]));
        const registros: Parameters<AuditoriaService['registrarVarias']>[1] =
          novas
            .filter(({ cnpj }) => idDoCnpj.has(cnpj))
            .map(({ empresa: _empresa, ...dados }) => ({
              usuarioId,
              acao: 'ASSOCIADO_IMPORTADO_JUCEMAT',
              entidade: 'Associado',
              entidadeId: idDoCnpj.get(dados.cnpj),
              associadoId: idDoCnpj.get(dados.cnpj),
              valorNovo: diferencas({}, dados)?.valorNovo,
            }));

        let completadas = 0;
        for (const empresa of empresas) {
          const atual = existentes.get(empresa.cnpj);
          if (!atual) continue;
          const faltam = camposQueFaltam(atual, empresa);
          if (!faltam) continue;
          await tx.associado.update({ where: { id: atual.id }, data: faltam });
          const mudanca = diferencas(
            Object.fromEntries(
              Object.keys(faltam).map((chave) => [chave, null]),
            ),
            faltam,
          );
          registros.push({
            usuarioId,
            acao: 'ASSOCIADO_COMPLETADO_JUCEMAT',
            entidade: 'Associado',
            entidadeId: atual.id,
            associadoId: atual.id,
            valorNovo: mudanca?.valorNovo,
          });
          completadas++;
        }

        await this.auditoria.registrarVarias(tx, registros);
        return {
          novas: criadas.length,
          completadas,
          semMudanca: existentes.size - completadas,
          erros,
        };
      },
      { timeout: 60_000 },
    );
  }
}

/** Os campos vazios no cadastro que o arquivo preenche; nulo se nenhum. */
function camposQueFaltam(
  atual: Record<(typeof COMPLETAVEIS)[number], string | null>,
  empresa: EmpresaJucemat,
): Partial<Record<(typeof COMPLETAVEIS)[number], string>> | null {
  const faltam: Partial<Record<(typeof COMPLETAVEIS)[number], string>> = {};
  for (const chave of COMPLETAVEIS) {
    const valor = empresa[chave];
    if (!atual[chave] && valor) faltam[chave] = valor;
  }
  return Object.keys(faltam).length > 0 ? faltam : null;
}
