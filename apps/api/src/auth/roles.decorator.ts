import { SetMetadata } from '@nestjs/common';
import type { Perfil } from '../generated/prisma/enums';

export const PERFIS_METADATA = 'perfis';
export const Perfis = (...perfis: Perfil[]) =>
  SetMetadata(PERFIS_METADATA, perfis);
