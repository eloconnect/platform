/**
 * ADMIN e ADMIN_BASICO são os dois perfis da sede (RN33): o chave mestre, com
 * todas as funções, e o básico, que publica conteúdo e consulta associados.
 */
export type Perfil = 'ADMIN' | 'ADMIN_BASICO' | 'ASSOCIADO';

export interface LoginRequest {
  email: string;
  senha: string;
}

export interface LoginResponse {
  accessToken: string;
  usuario: {
    id: string;
    email: string;
    nome: string;
    perfil: Perfil;
  };
}

export interface MensagemResponse {
  mensagem: string;
}

export interface EsqueciSenhaRequest {
  email: string;
}

export interface RedefinirSenhaRequest {
  token: string;
  senha: string;
}

/** Criação de conta pelo associado (RF05). O CNPJ pode vir com ou sem pontuação. */
export interface CriarContaRequest {
  cnpj: string;
}

/** Senha criada pelo link enviado ao e-mail do cadastro (RF05). */
export interface ConfirmarContaRequest {
  token: string;
  senha: string;
}
