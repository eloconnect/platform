import { NotFoundException } from '@nestjs/common';
import type { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { GatewayPagamento } from './gateway-pagamento.js';
import { PagamentosService } from './pagamentos.service.js';
import type { TransacoesService } from './transacoes.service.js';

function $transaction(): never {
  throw new Error('Não devia usar o banco.');
}

describe('PagamentosService', () => {
  it('não simula pagamento com o banco de verdade', () => {
    const pagamentos = new PagamentosService(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      { $transaction } as unknown as PrismaService,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      {} as TransacoesService,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      {} as AuditoriaService,
      // Qualquer gateway que não seja o simulado, como o do Sicredi.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      {} as GatewayPagamento,
    );

    expect(() => pagamentos.simular('usuario-id', 'boleto-id', 'PIX')).toThrow(
      NotFoundException,
    );
  });
});
