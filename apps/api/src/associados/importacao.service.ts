import type { ResultadoImportacao } from '@eloconnect/shared';
import { ConflictException, Injectable } from '@nestjs/common';
import {
  AuditoriaService,
  diferencas,
} from '../auditoria/auditoria.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { lerPlanilha } from './planilha.js';

/**
 * Carga inicial dos associados (RF42, O7). Não existe lista de quem já
 * paga (resposta 42), então a sede preenche a planilha modelo, e o sistema a
 * importa. É tudo ou nada: com qualquer erro, nada entra, e a sede corrige as
 * linhas e envia de novo, sem se preocupar com o que já entrou.
 */
@Injectable()
export class ImportacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async importar(
    usuarioId: string,
    texto: string,
  ): Promise<ResultadoImportacao> {
    const { linhas, erros } = lerPlanilha(texto);
    if (erros.length > 0) return { importados: 0, recebemBoleto: 0, erros };

    const existentes = new Set(
      (
        await this.prisma.associado.findMany({
          where: { cnpj: { in: linhas.map(({ cnpj }) => cnpj) } },
          select: { cnpj: true },
        })
      ).map(({ cnpj }) => cnpj),
    );
    if (existentes.size > 0) {
      return {
        importados: 0,
        recebemBoleto: 0,
        erros: linhas
          .filter(({ cnpj }) => existentes.has(cnpj))
          .map(({ linha }) => ({
            linha,
            mensagem: 'Este CNPJ já está no cadastro.',
          })),
      };
    }

    const dados = linhas.map(({ linha: _linha, ...associado }) => associado);
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const criados = await tx.associado.createManyAndReturn({
            data: dados.map((associado) => ({
              ...associado,
              // TODO(P27): quem já paga entra em dia, sem esperar o primeiro
              // boleto pelo sistema (decisão do grupo, 02/11/2026).
              situacao: associado.contribuicaoAtiva
                ? 'ADIMPLENTE'
                : 'INADIMPLENTE',
            })),
            select: { id: true, cnpj: true },
          });
          const idDoCnpj = new Map(criados.map(({ id, cnpj }) => [cnpj, id]));
          await this.auditoria.registrarVarias(
            tx,
            dados.map((associado) => {
              const id = idDoCnpj.get(associado.cnpj);
              return {
                usuarioId,
                acao: 'ASSOCIADO_IMPORTADO',
                entidade: 'Associado',
                entidadeId: id,
                associadoId: id,
                valorNovo: diferencas({}, associado)?.valorNovo,
              };
            }),
          );
        },
        { timeout: 60_000 },
      );
    } catch (erro) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        throw new ConflictException(
          'Um CNPJ da planilha entrou no cadastro enquanto isso. Envie a planilha de novo.',
        );
      }
      throw erro;
    }
    return {
      importados: dados.length,
      recebemBoleto: dados.filter((a) => a.contribuicaoAtiva).length,
      erros: [],
    };
  }
}
