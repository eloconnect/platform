import { IsOptional, IsUUID } from 'class-validator';

/** Filtro opcional da lista de pedidos, para o perfil do associado. */
export class ListarQuitacaoDto {
  @IsOptional()
  @IsUUID()
  associadoId?: string;
}
