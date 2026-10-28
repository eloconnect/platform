import type { CriarContaRequest } from '@eloconnect/shared';
import { IsCnpj, NormalizarCnpj } from '../../associados/dto/associado.dto.js';

export class CriarContaDto implements CriarContaRequest {
  @NormalizarCnpj()
  @IsCnpj()
  cnpj!: string;
}
