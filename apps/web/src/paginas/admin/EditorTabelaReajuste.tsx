import type { LinhaReajuste } from '@eloconnect/shared';
import { MAXIMO_LINHAS_REAJUSTE } from '@eloconnect/shared';
import Form from 'react-bootstrap/Form';
import { Botao } from '../../componentes';

/** Linha como a sede digita: os valores em texto, como no campo. */
export interface LinhaDigitada {
  chave: number;
  funcao: string;
  pisoAnterior: string;
  pisoNovo: string;
}

let proximaChave = 1;

export function linhaVazia(): LinhaDigitada {
  return { chave: proximaChave++, funcao: '', pisoAnterior: '', pisoNovo: '' };
}

/** Linhas salvas, prontas para editar ("1050.00" vira "1050,00"). */
export function linhasDigitadas(linhas: LinhaReajuste[]): LinhaDigitada[] {
  return linhas.map((linha) => ({
    chave: proximaChave++,
    funcao: linha.funcao,
    pisoAnterior: linha.pisoAnterior.replace('.', ','),
    pisoNovo: linha.pisoNovo.replace('.', ','),
  }));
}

/**
 * "1.050,00", "1050,5" ou "R$ 1050" viram "1050.00". Nulo quando não é um
 * valor em reais.
 */
export function lerReais(texto: string): string | null {
  let limpo = texto.replace(/R\$|\s/g, '');
  if (limpo.includes(',')) limpo = limpo.replace(/\./g, '').replace(',', '.');
  return /^\d{1,7}(\.\d{1,2})?$/.test(limpo) ? Number(limpo).toFixed(2) : null;
}

/**
 * Confere as linhas preenchidas e devolve a tabela, ou o erro para a sede.
 * Linhas totalmente vazias são ignoradas.
 */
export function conferirTabela(
  linhas: LinhaDigitada[],
): { tabela: LinhaReajuste[] } | { erro: string } {
  const tabela: LinhaReajuste[] = [];
  for (const [indice, linha] of linhas.entries()) {
    const funcao = linha.funcao.trim();
    if (!funcao && !linha.pisoAnterior.trim() && !linha.pisoNovo.trim()) {
      continue;
    }
    const pisoAnterior = lerReais(linha.pisoAnterior);
    const pisoNovo = lerReais(linha.pisoNovo);
    if (!funcao || !pisoAnterior || !pisoNovo) {
      return {
        erro: `Confira a linha ${indice + 1} da tabela: informe a função e os dois pisos em reais.`,
      };
    }
    tabela.push({ funcao, pisoAnterior, pisoNovo });
  }
  return { tabela };
}

/**
 * Tabela de reajuste salarial no formulário da convenção (US21: RF21, P24):
 * uma linha por função, com o piso anterior e o novo.
 */
export function EditorTabelaReajuste({
  linhas,
  erro,
  aoMudar,
}: {
  linhas: LinhaDigitada[];
  erro?: string;
  aoMudar: (linhas: LinhaDigitada[]) => void;
}) {
  function mudar(chave: number, campo: keyof LinhaReajuste, valor: string) {
    aoMudar(
      linhas.map((linha) =>
        linha.chave === chave ? { ...linha, [campo]: valor } : linha,
      ),
    );
  }

  return (
    <fieldset className="mb-3">
      <legend className="h5">Tabela de reajuste (opcional)</legend>
      <p className="text-body-secondary">
        Uma linha por função, com o piso salarial anterior e o novo. Só quem
        está em dia vê a tabela.
      </p>
      {linhas.map((linha, indice) => (
        <div key={linha.chave} className="border rounded p-3 mb-3">
          <Form.Group className="mb-2" controlId={`funcao-${linha.chave}`}>
            <Form.Label>Função da linha {indice + 1}</Form.Label>
            <Form.Control
              value={linha.funcao}
              maxLength={120}
              onChange={(e) => mudar(linha.chave, 'funcao', e.target.value)}
            />
          </Form.Group>
          <div className="d-flex flex-wrap gap-3">
            <Form.Group controlId={`anterior-${linha.chave}`}>
              <Form.Label>Piso anterior (R$)</Form.Label>
              <Form.Control
                inputMode="decimal"
                value={linha.pisoAnterior}
                onChange={(e) =>
                  mudar(linha.chave, 'pisoAnterior', e.target.value)
                }
              />
            </Form.Group>
            <Form.Group controlId={`novo-${linha.chave}`}>
              <Form.Label>Piso novo (R$)</Form.Label>
              <Form.Control
                inputMode="decimal"
                value={linha.pisoNovo}
                onChange={(e) => mudar(linha.chave, 'pisoNovo', e.target.value)}
              />
            </Form.Group>
          </div>
          <Botao
            variant="outline-secondary"
            size="sm"
            className="mt-2"
            onClick={() =>
              aoMudar(linhas.filter(({ chave }) => chave !== linha.chave))
            }
          >
            Remover a linha {indice + 1}
          </Botao>
        </div>
      ))}
      {erro && (
        <p className="text-danger" role="alert">
          {erro}
        </p>
      )}
      {linhas.length < MAXIMO_LINHAS_REAJUSTE && (
        <Botao
          variant="outline-primary"
          onClick={() => aoMudar([...linhas, linhaVazia()])}
        >
          Adicionar uma linha
        </Botao>
      )}
    </fieldset>
  );
}
