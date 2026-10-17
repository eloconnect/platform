export type Perfil = 'ADMIN' | 'ASSOCIADO';

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
