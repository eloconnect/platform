import { useId, useLayoutEffect, useState } from 'react';

/**
 * Os tamanhos da letra. O tema troca o tamanho base pelo atributo
 * data-letra na raiz do documento, e todo o resto acompanha (tudo em rem).
 */
const NIVEIS = [
  { valor: '', rotulo: 'A', nome: 'Letra normal' },
  { valor: 'grande', rotulo: 'A+', nome: 'Letra grande' },
  { valor: 'maior', rotulo: 'A++', nome: 'Letra maior' },
] as const;

type Nivel = (typeof NIVEIS)[number]['valor'];

const CHAVE = 'elo-tamanho-letra';

/** A escolha fica no próprio aparelho; sem acesso ao armazenamento, é a normal. */
function lerNivel(): Nivel {
  try {
    const salvo = localStorage.getItem(CHAVE);
    return NIVEIS.find((nivel) => nivel.valor === salvo)?.valor ?? '';
  } catch {
    return '';
  }
}

/**
 * Botões "A / A+ / A++", como em sites de jornal: aumentam a letra do site
 * sem mexer nas configurações do celular (RNF01).
 */
export function TamanhoLetra() {
  const id = useId();
  const [nivel, setNivel] = useState<Nivel>(lerNivel);

  useLayoutEffect(() => {
    const raiz = document.documentElement;
    if (nivel) raiz.dataset.letra = nivel;
    else delete raiz.dataset.letra;
    return () => {
      delete raiz.dataset.letra;
    };
  }, [nivel]);

  function escolher(novo: Nivel) {
    setNivel(novo);
    try {
      localStorage.setItem(CHAVE, novo);
    } catch {
      // Sem armazenamento, vale só até fechar a página.
    }
  }

  return (
    <div className="elo-tamanho-letra" role="group" aria-labelledby={id}>
      <span id={id}>Tamanho da letra</span>
      {NIVEIS.map((opcao) => (
        <button
          key={opcao.rotulo}
          type="button"
          className="btn"
          aria-pressed={nivel === opcao.valor}
          onClick={() => escolher(opcao.valor)}
        >
          <span aria-hidden="true">{opcao.rotulo}</span>
          <span className="visually-hidden">{opcao.nome}</span>
        </button>
      ))}
    </div>
  );
}
