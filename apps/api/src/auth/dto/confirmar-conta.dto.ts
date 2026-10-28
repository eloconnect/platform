import type { ConfirmarContaRequest } from '@eloconnect/shared';
import { RedefinirSenhaDto } from './redefinir-senha.dto.js';

/** Mesmas regras do link de redefinir senha: token do e-mail e senha nova. */
export class ConfirmarContaDto
  extends RedefinirSenhaDto
  implements ConfirmarContaRequest {}
