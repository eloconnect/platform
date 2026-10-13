import { useEffect, useState } from 'react';
import { ApiError } from '@eloconnect/shared';
import { lerToken } from '../../sessao';

interface Estado<T> {
  dados: T | null;
  erro: string | null;
  carregando: boolean;
}

interface Resultado<T> extends Estado<T> {
  /** Troca os dados exibidos (ex.: com a resposta de uma gravação). */
  definir: (dados: T) => void;
}

/** Carrega dados do painel da sede com o token da sessão. */
export function useDadosAdmin<T>(
  carregar: (token: string) => Promise<T>,
  dependencias: readonly unknown[],
): Resultado<T> {
  const [estado, setEstado] = useState<Estado<T>>({
    dados: null,
    erro: null,
    carregando: true,
  });

  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let ativo = true;
    const token = lerToken();
    if (!token) {
      setEstado({
        dados: null,
        erro: 'Entre com sua conta para ver estes dados.',
        carregando: false,
      });
      return;
    }
    setEstado((atual) => ({ ...atual, carregando: true, erro: null }));
    carregar(token).then(
      (dados) => ativo && setEstado({ dados, erro: null, carregando: false }),
      (erro: unknown) =>
        ativo &&
        setEstado({
          dados: null,
          carregando: false,
          erro:
            erro instanceof ApiError && erro.status === 401
              ? 'Sua sessão expirou. Entre novamente.'
              : 'Não foi possível carregar os dados agora.',
        }),
    );
    return () => {
      ativo = false;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);

  return {
    ...estado,
    definir: (dados: T) => setEstado({ dados, erro: null, carregando: false }),
  };
}

export async function executarAdmin<T>(
  acao: (token: string) => Promise<T>,
): Promise<{ dados: T | null; erro: string | null }> {
  const token = lerToken();
  if (!token) {
    return { dados: null, erro: 'Entre com sua conta.' };
  }
  try {
    return { dados: await acao(token), erro: null };
  } catch (erro) {
    const status = erro instanceof ApiError ? erro.status : 0;
    return {
      dados: null,
      erro:
        status === 401
          ? 'Sua sessão expirou. Entre novamente.'
          : status === 409
            ? 'Esta solicitação já foi decidida.'
            : status === 400
              ? 'Confira os dados informados.'
              : 'Não foi possível concluir a ação agora.',
    };
  }
}

export const moeda = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const data = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';

export const cnpjMascarado = (cnpj: string) =>
  cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
