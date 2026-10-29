/** Os dois grupos de benefícios (RN32). */
export const GRUPOS_BENEFICIO = ['ASSESSORIA_JURIDICA', 'CONSULTORIA'] as const;

export type GrupoBeneficio = (typeof GRUPOS_BENEFICIO)[number];

export function ehGrupoBeneficio(valor: string): valor is GrupoBeneficio {
  return (GRUPOS_BENEFICIO as readonly string[]).includes(valor);
}

export const TEXTO_GRUPO_BENEFICIO: Record<GrupoBeneficio, string> = {
  ASSESSORIA_JURIDICA: 'Assessoria jurídica',
  CONSULTORIA: 'Consultoria',
};

/** Benefício do sindicato, como a API devolve (RF24). */
export interface Beneficio {
  id: string;
  titulo: string;
  descricao: string;
  grupo: GrupoBeneficio;
}

/** Cadastro de benefício pela sede (RF24). */
export interface CriarBeneficioRequest {
  titulo: string;
  descricao: string;
  grupo: GrupoBeneficio;
}

/** Edição pela sede: só os campos enviados mudam. */
export type EditarBeneficioRequest = Partial<CriarBeneficioRequest>;
