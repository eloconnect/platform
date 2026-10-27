// Seed de desenvolvimento: SOMENTE dados fictícios (RNF10).
// CNPJs gerados (com dígito verificador válido) e e-mails @example.com.
// Rode com `pnpm --filter api db:seed` ou recrie o banco com `db:reset`.
import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * Senha de todos os usuários do seed. Em desenvolvimento é a pública; na
 * demonstração vem de SEED_SENHA, que só a equipe conhece (docs/deploy.md).
 */
const SENHA = process.env.SEED_SENHA || 'eloconnect123';

const MUNICIPIOS = [
  'Cuiabá',
  'Várzea Grande',
  'Rondonópolis',
  'Sinop',
  'Tangará da Serra',
  'Cáceres',
  'Sorriso',
  'Lucas do Rio Verde',
];

const VALOR_MENSAL = '120.00';
const VALOR_ANUAL = '1152.00'; // 12 meses com 20% de desconto (RN13)

/** Dígito verificador do CNPJ para os 12 ou 13 primeiros dígitos. */
function digitoCnpj(numeros: string): string {
  const pesos =
    numeros.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = numeros
    .split('')
    .reduce((total, n, i) => total + Number(n) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? '0' : String(11 - resto);
}

/** Gera um CNPJ fictício, só dígitos, com dígitos verificadores válidos. */
function gerarCnpj(indice: number): string {
  const base = String(41000000 + indice * 7919).padStart(8, '0') + '0001';
  const d1 = digitoCnpj(base);
  return base + d1 + digitoCnpj(base + d1);
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('O seed é só para desenvolvimento.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    if ((await prisma.usuario.count()) > 0) {
      console.log(
        'O banco já tem dados. Para recriar do zero: pnpm --filter api db:reset',
      );
      return;
    }

    const senhaHash = await hash(SENHA);

    // Usuários da sede
    const admin = await prisma.usuario.create({
      data: {
        email: 'admin@example.com',
        nome: 'Administrador de Teste',
        perfil: 'ADMIN',
        senhaHash,
        emailConfirmadoEm: new Date(),
      },
    });
    await prisma.usuario.create({
      data: {
        email: 'sede@example.com',
        nome: 'Funcionária de Teste',
        perfil: 'ADMIN',
        senhaHash,
        emailConfirmadoEm: new Date(),
      },
    });

    // Associados: 1 a 8 com contribuição ativa; 7 e 8 com boleto vencido;
    // 9 a 20 sem contribuição (nunca pagaram).
    const associados = [];
    for (let i = 1; i <= 20; i++) {
      const ativo = i <= 8;
      associados.push(
        await prisma.associado.create({
          data: {
            cnpj: gerarCnpj(i),
            razaoSocial: `Farmácia Exemplo ${doisDigitos(i)} Ltda`,
            nomeFantasia: `Drogaria Exemplo ${doisDigitos(i)}`,
            email: `farmacia${doisDigitos(i)}@example.com`,
            telefone: `(65) 90000-00${doisDigitos(i)}`,
            municipio: MUNICIPIOS[(i - 1) % MUNICIPIOS.length],
            contribuicaoAtiva: ativo,
            situacao: ativo && i <= 6 ? 'ADIMPLENTE' : 'INADIMPLENTE',
            // Associado 5: adimplente, mas bloqueado manualmente pela sede (RN11)
            acessoManual: i === 5 ? 'BLOQUEADO' : null,
          },
        }),
      );
    }

    // Contas de associado para testar os dois status
    await prisma.usuario.create({
      data: {
        email: 'associado@example.com',
        nome: 'Responsável Farmácia 01',
        perfil: 'ASSOCIADO',
        senhaHash,
        emailConfirmadoEm: new Date(),
        associadoId: associados[0].id,
      },
    });
    await prisma.usuario.create({
      data: {
        email: 'inadimplente@example.com',
        nome: 'Responsável Farmácia 07',
        perfil: 'ASSOCIADO',
        senhaHash,
        emailConfirmadoEm: new Date(),
        associadoId: associados[6].id,
      },
    });

    // Valor vigente da contribuição
    await prisma.valorContribuicao.create({
      data: {
        valorMensal: VALOR_MENSAL,
        valorAnual: VALOR_ANUAL,
        alteradoPorId: admin.id,
      },
    });
    await prisma.logAuditoria.create({
      data: {
        usuarioId: admin.id,
        acao: 'VALOR_ALTERADO',
        entidade: 'ValorContribuicao',
        valorNovo: { valorMensal: VALOR_MENSAL, valorAnual: VALOR_ANUAL },
      },
    });

    // Lote do mês passado, já enviado
    const hoje = new Date();
    const competencia = new Date(
      Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1),
    );
    const vencimento = new Date(
      Date.UTC(competencia.getUTCFullYear(), competencia.getUTCMonth(), 10),
    );
    const emitidoEm = new Date(
      Date.UTC(competencia.getUTCFullYear(), competencia.getUTCMonth(), 1, 12),
    );
    const lote = await prisma.loteMensal.create({
      data: {
        competencia,
        status: 'ENVIADO',
        geradoEm: emitidoEm,
        enviadoEm: emitidoEm,
        enviadoPorId: admin.id,
      },
    });
    await prisma.logAuditoria.create({
      data: {
        usuarioId: admin.id,
        acao: 'LOTE_ENVIADO',
        entidade: 'LoteMensal',
        entidadeId: lote.id,
      },
    });

    for (const [i, associado] of associados.slice(0, 8).entries()) {
      const pago = i < 6;
      const nossoNumero = `SEED${String(i + 1).padStart(6, '0')}`;
      const pagoEm = pago
        ? new Date(vencimento.getTime() - (i + 1) * 86_400_000)
        : null;
      const boleto = await prisma.boleto.create({
        data: {
          associadoId: associado.id,
          loteId: lote.id,
          tipo: 'MENSAL',
          competencia,
          valor: VALOR_MENSAL,
          vencimento,
          status: pago ? 'PAGO' : 'EM_ABERTO',
          sicrediNossoNumero: nossoNumero,
          linhaDigitavel: `74891.00000 00000.000000 00000.000000 0 0000000${String(i + 1).padStart(5, '0')}`,
          pixCopiaECola: `00020126-pix-ficticio-${nossoNumero}`,
          emitidoEm,
          pagoEm,
        },
      });

      const base = {
        boletoId: boleto.id,
        associadoId: associado.id,
        valor: VALOR_MENSAL,
        sicrediNossoNumero: nossoNumero,
      };
      await prisma.transacao.create({
        data: { ...base, evento: 'GERADO', ocorridoEm: emitidoEm },
      });
      await prisma.transacao.create({
        data: {
          ...base,
          evento: 'EMITIDO',
          usuarioId: admin.id,
          ocorridoEm: emitidoEm,
        },
      });
      if (pagoEm) {
        await prisma.transacao.create({
          data: {
            ...base,
            evento: 'PAGO',
            formaPagamento: i % 2 === 0 ? 'PIX' : 'BOLETO',
            ocorridoEm: pagoEm,
          },
        });
      }
    }

    // Bloqueio manual do associado 5 e cancelamento pendente do associado 3
    await prisma.logAuditoria.create({
      data: {
        usuarioId: admin.id,
        acao: 'ACESSO_BLOQUEADO',
        entidade: 'Associado',
        entidadeId: associados[4].id,
        associadoId: associados[4].id,
        valorAnterior: { acessoManual: null },
        valorNovo: { acessoManual: 'BLOQUEADO' },
      },
    });
    await prisma.solicitacaoCancelamento.create({
      data: {
        associadoId: associados[2].id,
        motivo: 'Motivo fictício para teste.',
      },
    });

    // Conteúdo
    await prisma.convencao.create({
      data: {
        titulo: 'Convenção Coletiva de Exemplo',
        ano: hoje.getUTCFullYear(),
        resumo:
          'Resumo fictício da convenção coletiva, só para desenvolvimento. ' +
          'O conteúdo real é publicado pela sede.',
        tabelaReajuste: [
          { funcao: 'Função de exemplo A', pisoAnterior: 1000, pisoNovo: 1050 },
          { funcao: 'Função de exemplo B', pisoAnterior: 1500, pisoNovo: 1575 },
        ],
        publicadaEm: new Date(),
        autorId: admin.id,
      },
    });
    await prisma.noticia.createMany({
      data: [
        {
          titulo: 'Notícia de exemplo publicada',
          conteudo: 'Texto fictício de uma notícia publicada pela sede.',
          publicadaEm: new Date(),
          autorId: admin.id,
        },
        {
          titulo: 'Outra notícia de exemplo',
          conteudo: 'Mais um texto fictício para testar o feed.',
          publicadaEm: new Date(Date.now() - 3 * 86_400_000),
          autorId: admin.id,
        },
        {
          titulo: 'Rascunho de notícia',
          conteudo: 'Não deve aparecer no feed dos associados.',
          autorId: admin.id,
        },
      ],
    });
    // TODO(P06): lista real de benefícios depende do cliente.
    await prisma.beneficio.createMany({
      data: [
        {
          titulo: 'Benefício de exemplo 1',
          descricao: 'Descrição fictícia.',
          ordem: 1,
        },
        {
          titulo: 'Benefício de exemplo 2',
          descricao: 'Descrição fictícia.',
          ordem: 2,
        },
        {
          titulo: 'Benefício de exemplo 3',
          descricao: 'Descrição fictícia.',
          ordem: 3,
        },
      ],
    });

    console.log(
      `Seed concluído. Senha de todos os usuários: ${process.env.SEED_SENHA ? 'a da SEED_SENHA' : SENHA}`,
    );
    console.log('  admin@example.com        (admin)');
    console.log('  sede@example.com         (admin)');
    console.log('  associado@example.com    (associado adimplente)');
    console.log('  inadimplente@example.com (associado com boleto vencido)');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro: unknown) => {
  console.error(erro);
  process.exit(1);
});
