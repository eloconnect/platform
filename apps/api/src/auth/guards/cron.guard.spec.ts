import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronGuard } from './cron.guard.js';

const SEGREDO = 'segredo-do-cron-de-teste';

function guarda(segredo?: string) {
  return new CronGuard({ get: () => segredo } as unknown as ConfigService);
}

function pedido(authorization?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  } as unknown as ExecutionContext;
}

describe('CronGuard', () => {
  it('libera quem manda o CRON_SECRET', () => {
    expect(guarda(SEGREDO).canActivate(pedido(`Bearer ${SEGREDO}`))).toBe(true);
  });

  it.each([
    ['sem o cabeçalho', undefined],
    ['com outro segredo', 'Bearer outro-segredo-de-teste'],
    ['sem o Bearer', SEGREDO],
  ])('recusa o pedido %s', (_caso, authorization) => {
    expect(() => guarda(SEGREDO).canActivate(pedido(authorization))).toThrow(
      UnauthorizedException,
    );
  });

  it('recusa tudo quando a hospedagem não tem o CRON_SECRET', () => {
    expect(() =>
      guarda(undefined).canActivate(pedido('Bearer undefined')),
    ).toThrow(UnauthorizedException);
    expect(() => guarda('').canActivate(pedido('Bearer '))).toThrow(
      UnauthorizedException,
    );
  });
});
