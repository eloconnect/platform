import type { ImagemNoticia as Imagem } from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import { api } from '../../api';

/**
 * Imagem da notícia (RF41). Ela não tem endereço público: a tela baixa pela
 * API, com o login (RN28), e mostra. Sem descrição, o leitor de tela pula a
 * imagem. A sede usa a mesma imagem na lista e na edição.
 */
export function ImagemNoticia({
  noticiaId,
  imagem,
  className = 'img-fluid rounded d-block mb-3',
}: {
  noticiaId: string;
  imagem: Imagem;
  className?: string;
}) {
  // Guarda de qual imagem é o resultado: a imagem trocada (outro objeto)
  // é baixada de novo, e a anterior some até a nova chegar.
  const [carregada, setCarregada] = useState<
    { de: Imagem; endereco: string } | { de: Imagem; erro: true }
  >();

  useEffect(() => {
    let ativo = true;
    let criado: string | undefined;
    void api
      .baixarImagemNoticia(noticiaId)
      .then((arquivo) => {
        if (!ativo) return;
        criado = URL.createObjectURL(arquivo);
        setCarregada({ de: imagem, endereco: criado });
      })
      .catch(() => ativo && setCarregada({ de: imagem, erro: true }));
    return () => {
      ativo = false;
      if (criado) URL.revokeObjectURL(criado);
    };
  }, [noticiaId, imagem]);

  if (carregada?.de !== imagem) return null;
  if ('erro' in carregada) {
    return (
      <p className="text-body-secondary">Não foi possível carregar a imagem.</p>
    );
  }
  return (
    <img
      src={carregada.endereco}
      alt={imagem.descricao ?? ''}
      className={className}
    />
  );
}
