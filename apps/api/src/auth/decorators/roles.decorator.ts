import { SetMetadata } from '@nestjs/common';
import { Perfil } from '../../generated/prisma';

export const ROLES_KEY = 'perfis';
export const Roles = (...perfis: Perfil[]) => SetMetadata(ROLES_KEY, perfis);
