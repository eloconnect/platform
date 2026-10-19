import { SetMetadata } from '@nestjs/common';

export const Roles = (...perfis: string[]) => SetMetadata('perfis', perfis);
