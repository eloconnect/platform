/**
 * Catálogo das ações gravadas no log de auditoria (RN26, RF39).
 * Cada funcionalidade nova da sede acrescenta as suas ações aqui e o texto
 * delas em `TEXTO_ACAO_AUDITORIA`.
 */
export const ACOES_AUDITORIA = [
  // Associados
  'ASSOCIADO_CRIADO',
  'ASSOCIADO_EDITADO',
  'ASSOCIADO_INATIVADO',
  'ASSOCIADO_REATIVADO',
  'CONTRIBUICAO_ATIVADA',
  'CONTRIBUICAO_INTERROMPIDA',
  // Troca do e-mail de acesso junto com o do cadastro (RN34)
  'CONTA_EMAIL_ALTERADO',
  // Acesso manual (RN11): bloquear, liberar ou voltar a seguir o pagamento
  'ACESSO_BLOQUEADO',
  'ACESSO_LIBERADO',
  'ACESSO_AUTOMATICO',
  // Cobrança (o lote mensal vem na M3)
  'VALOR_ALTERADO',
  'LOTE_ENVIADO',
  // Benefícios (RF24)
  'BENEFICIO_CRIADO',
  'BENEFICIO_EDITADO',
  'BENEFICIO_REMOVIDO',
  // Notícias (RF41)
  'NOTICIA_PUBLICADA',
  'NOTICIA_EDITADA',
  'NOTICIA_REMOVIDA',
  // Convenções coletivas (RF21)
  'CONVENCAO_CRIADA',
  'CONVENCAO_EDITADA',
  'CONVENCAO_PUBLICADA',
  'CONVENCAO_REMOVIDA',
  'CONVENCAO_ANEXOS_ATUALIZADOS',
] as const;

export type AcaoAuditoria = (typeof ACOES_AUDITORIA)[number];

/** O que cada ação quer dizer, na tela do log (RF40). */
export const TEXTO_ACAO_AUDITORIA: Record<AcaoAuditoria, string> = {
  ASSOCIADO_CRIADO: 'Associado cadastrado',
  ASSOCIADO_EDITADO: 'Cadastro editado',
  ASSOCIADO_INATIVADO: 'Associado inativado',
  ASSOCIADO_REATIVADO: 'Associado reativado',
  CONTRIBUICAO_ATIVADA: 'Boleto mensal ativado',
  CONTRIBUICAO_INTERROMPIDA: 'Boleto mensal interrompido',
  CONTA_EMAIL_ALTERADO: 'E-mail de acesso trocado',
  ACESSO_BLOQUEADO: 'Acesso bloqueado',
  ACESSO_LIBERADO: 'Acesso liberado',
  ACESSO_AUTOMATICO: 'Acesso voltou a seguir o pagamento',
  VALOR_ALTERADO: 'Valor da contribuição alterado',
  LOTE_ENVIADO: 'Lote mensal enviado',
  BENEFICIO_CRIADO: 'Benefício cadastrado',
  BENEFICIO_EDITADO: 'Benefício editado',
  BENEFICIO_REMOVIDO: 'Benefício removido',
  NOTICIA_PUBLICADA: 'Notícia publicada',
  NOTICIA_EDITADA: 'Notícia editada',
  NOTICIA_REMOVIDA: 'Notícia removida',
  CONVENCAO_CRIADA: 'Convenção cadastrada',
  CONVENCAO_EDITADA: 'Convenção editada',
  CONVENCAO_PUBLICADA: 'Convenção publicada',
  CONVENCAO_REMOVIDA: 'Convenção removida',
  CONVENCAO_ANEXOS_ATUALIZADOS: 'PDFs da convenção atualizados',
};

export function ehAcaoAuditoria(valor: string): valor is AcaoAuditoria {
  return (ACOES_AUDITORIA as readonly string[]).includes(valor);
}

/** Texto da ação; uma ação fora do catálogo aparece com o próprio código. */
export function textoAcaoAuditoria(acao: string): string {
  return ehAcaoAuditoria(acao) ? TEXTO_ACAO_AUDITORIA[acao] : acao;
}

/** Valor de um campo no log: as datas vêm em texto ISO. */
export type ValorCampoLog = string | number | boolean | null;

/** Uma ação do log, como a API devolve para a sede (RF40). */
export interface ItemLogAuditoria {
  id: string;
  /** Data e hora em texto ISO. */
  ocorridoEm: string;
  /** Uma das `ACOES_AUDITORIA`. Use `textoAcaoAuditoria` para mostrar. */
  acao: string;
  /** Quem da sede fez a ação. */
  usuario: UsuarioSede;
  /** Nulo quando a ação não envolve um associado (ex.: valor alterado). */
  associado: { id: string; cnpj: string; razaoSocial: string } | null;
  /**
   * O que a ação afetou, quando não é um associado, para a tela dizer qual
   * foi (ex.: { tipo: 'Benefício', nome: 'Assessoria trabalhista' }).
   */
  registro: { tipo: string; nome: string } | null;
  /** Só os campos que mudaram, com o valor de antes e o de depois. */
  valorAnterior: Record<string, ValorCampoLog> | null;
  valorNovo: Record<string, ValorCampoLog> | null;
}

/** Pessoa da sede, para o filtro por usuário. */
export interface UsuarioSede {
  id: string;
  nome: string;
}

/** Filtros da consulta do log (RF40). */
export interface FiltrosLogAuditoria {
  /** Quem da sede fez a ação. */
  usuarioId?: string;
  /** Parte da razão social, do nome fantasia ou do CNPJ do associado. */
  associado?: string;
  acao?: AcaoAuditoria;
  /** Primeiro dia do período (AAAA-MM-DD), no horário de Mato Grosso. */
  de?: string;
  /** Último dia do período (AAAA-MM-DD), incluído na busca. */
  ate?: string;
  /** Começa em 1. */
  pagina?: number;
}

/** Da ação mais recente para a mais antiga. */
export interface ListaLogAuditoria {
  itens: ItemLogAuditoria[];
  total: number;
  pagina: number;
  porPagina: number;
}
