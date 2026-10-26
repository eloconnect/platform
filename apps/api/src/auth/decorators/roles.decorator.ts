import { SetMetadata } from '@nestjs/common';
import { Perfil } from '../../generated/prisma/enums.js';

export const ROLES_KEY = 'perfis';
export const Roles = (...perfis: Perfil[]) => SetMetadata(ROLES_KEY, perfis);
