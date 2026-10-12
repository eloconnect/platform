import type { Request } from 'express';
import type { Perfil } from '../generated/prisma/enums';

export interface AuthenticatedUser {
  id: string;
  email: string;
  nome: string;
  perfil: Perfil;
}

export interface AuthRequest extends Request {
  authSessionId?: string;
  authUser?: AuthenticatedUser;
}
