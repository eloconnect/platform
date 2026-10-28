import { cnpjValido, normalizarCnpj } from '@eloconnect/shared';
import type {
  AcessoManualStatus,
  CriarAssociadoRequest,
  DefinirAcessoRequest,
  EditarAssociadoRequest,
} from '@eloconnect/shared';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  registerDecorator,
} from 'class-validator';

/** Guarda o CNPJ só com letras e dígitos. */
export const NormalizarCnpj = () =>
  Transform(({ value }) =>
    typeof value === 'string' ? normalizarCnpj(value) : value,
  );

/** Tira os espaços das pontas; texto vazio vira null (campo apagado). */
const TextoOpcional = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const texto = value.trim();
    return texto === '' ? null : texto;
  });

export function IsCnpj() {
  return (objeto: object, propriedade: string) =>
    registerDecorator({
      name: 'isCnpj',
      target: objeto.constructor,
      propertyName: propriedade,
      options: { message: 'CNPJ inválido.' },
      validator: {
        validate: (valor: unknown) =>
          typeof valor === 'string' && cnpjValido(valor),
      },
    });
}

export class CriarAssociadoDto implements CriarAssociadoRequest {
  @NormalizarCnpj()
  @IsCnpj()
  cnpj: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  razaoSocial: string;

  @TextoOpcional()
  @IsOptional()
  @IsString()
  nomeFantasia?: string | null;

  @TextoOpcional()
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @TextoOpcional()
  @IsOptional()
  @IsString()
  telefone?: string | null;

  @TextoOpcional()
  @IsOptional()
  @IsString()
  municipio?: string | null;

  @IsOptional()
  @IsBoolean()
  contribuicaoAtiva?: boolean;
}

/** Edição: só os campos enviados mudam. CNPJ e razão social não podem ficar vazios. */
export class EditarAssociadoDto implements EditarAssociadoRequest {
  @ValidateIf((_objeto, valor) => valor !== undefined)
  @NormalizarCnpj()
  @IsCnpj()
  cnpj?: string;

  @ValidateIf((_objeto, valor) => valor !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  razaoSocial?: string;

  @TextoOpcional()
  @IsOptional()
  @IsString()
  nomeFantasia?: string | null;

  @TextoOpcional()
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @TextoOpcional()
  @IsOptional()
  @IsString()
  telefone?: string | null;

  @TextoOpcional()
  @IsOptional()
  @IsString()
  municipio?: string | null;

  @IsOptional()
  @IsBoolean()
  contribuicaoAtiva?: boolean;
}

/** Bloquear, liberar ou devolver ao automático o acesso (RF09, RN11). */
export class DefinirAcessoDto implements DefinirAcessoRequest {
  @IsIn(['LIBERADO', 'BLOQUEADO', null])
  acessoManual!: AcessoManualStatus;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo!: string;
}
