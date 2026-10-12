import type { Request } from 'express';
import { SESSION_COOKIE_NAME } from './auth.constants';

export function readSessionToken(request: Pick<Request, 'cookies'>) {
  const token: unknown = request.cookies?.[SESSION_COOKIE_NAME];
  return typeof token === 'string' ? token : undefined;
}
