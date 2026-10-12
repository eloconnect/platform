import type { Request } from 'express';
import type { UserRole } from '../generated/prisma/enums';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  authSessionId?: string;
  authUser?: AuthenticatedUser;
}
