import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Perfil } from '../generated/prisma/enums';
import { PERFIS_METADATA } from './roles.decorator';
import { RolesGuard } from './roles.guard';

const handler = () => undefined;
const profileCases: Array<[Perfil, Perfil, boolean]> = [
  [Perfil.ADMIN, Perfil.ADMIN, true],
  [Perfil.ASSOCIADO, Perfil.ASSOCIADO, true],
  [Perfil.ASSOCIADO, Perfil.ADMIN, false],
  [Perfil.ADMIN, Perfil.ASSOCIADO, false],
];

describe('RolesGuard', () => {
  it.each(profileCases)(
    'allows profile %s for required profile %s: %s',
    (userProfile, requiredProfile, expected) => {
      const reflector = new Reflector();
      Reflect.defineMetadata(PERFIS_METADATA, [requiredProfile], handler);
      const guard = new RolesGuard(reflector);
      const context = new ExecutionContextHost(
        [{ authUser: { perfil: userProfile } }],
        Object,
        handler,
      );
      context.setType('http');

      expect(guard.canActivate(context)).toBe(expected);
    },
  );
});
