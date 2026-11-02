import type { BoletoHistorico } from '@eloconnect/shared';
import { csvHistorico, pdfHistorico } from './exportar-historico.js';

const JULHO: BoletoHistorico = {
  id: 'boleto-07',
  competencia: { ano: 2099, mes: 7 },
  tipo: 'MENSAL',
  valor: '1300.00',
  vencimento: '2099-07-10',
  status: 'EM_ABERTO',
  vencido: true,
  pagoEm: null,
  formaPagamento: null,
};

const JUNHO: BoletoHistorico = {
  ...JULHO,
  id: 'boleto-06',
  competencia: { ano: 2099, mes: 6 },
  tipo: 'AVULSO',
  valor: '120.00',
  vencimento: '2099-06-10',
  status: 'PAGO',
  vencido: false,
  pagoEm: '2099-06-08T15:00:00.000Z',
  formaPagamento: 'PIX',
};

const DADOS = {
  razaoSocial: 'Farmácia (Centro) Ltda',
  cnpj: '12345678000190',
  // 17h05 em Mato Grosso.
  emitidoEm: new Date('2026-11-02T21:05:00Z'),
  boletos: [JULHO, JUNHO],
};

/** Confere que cada posição da tabela xref aponta para o seu objeto. */
function conferirXref(pdf: string, objetos: number) {
  const xref = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
  const posicoes = pdf
    .slice(xref)
    .split('\n')
    .filter((linha) => linha.endsWith(' 00000 n '))
    .map((linha) => Number(linha.slice(0, 10)));
  expect(posicoes).toHaveLength(objetos);
  posicoes.forEach((posicao, indice) => {
    expect(pdf.startsWith(`${indice + 1} 0 obj\n`, posicao)).toBe(true);
  });
}

describe('pdfHistorico', () => {
  it('mostra o associado, a data de emissão e uma linha por boleto', () => {
    const pdf = pdfHistorico(DADOS).toString('latin1');

    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf.endsWith('%%EOF\n')).toBe(true);
    expect(pdf).toContain('(Histórico de pagamentos)');
    expect(pdf).toContain('(Farmácia \\(Centro\\) Ltda)');
    expect(pdf).toContain('(CNPJ: 12.345.678/0001-90)');
    expect(pdf).toContain(
      '(Emitido pelo Elo Connect em 02/11/2026 às 17:05 \\(horário de Mato Grosso\\).)',
    );
    for (const celula of [
      'julho de 2099',
      // O real vem com espaço que não quebra a linha.
      'R$\u00a01.300,00',
      '10/07/2099',
      'Vencido',
      'junho de 2099 \\(avulso\\)',
      'Pago em 08/06/2099, com Pix',
    ]) {
      expect(pdf).toContain(`(${celula})`);
    }
    expect(pdf).toContain('/Count 1');
    expect(pdf).toContain('(Página 1 de 1)');
    conferirXref(pdf, 7);
  });

  it('continua a tabela nas páginas seguintes, com o cabeçalho repetido', () => {
    const boletos = Array.from({ length: 60 }, (_, i) => ({
      ...JUNHO,
      id: `boleto-${i}`,
    }));

    const pdf = pdfHistorico({ ...DADOS, boletos }).toString('latin1');

    expect(pdf).toContain('/Count 2');
    expect(pdf).toContain('(Página 1 de 2)');
    expect(pdf).toContain('(Página 2 de 2)');
    expect(pdf.match(/\(Situação\)/g)).toHaveLength(2);
    expect(pdf.match(/\(Pago em 08\/06\/2099, com Pix\)/g)).toHaveLength(60);
    conferirXref(pdf, 9);
  });

  it('diz que não há boleto, para comprovar a não contribuição', () => {
    const pdf = pdfHistorico({ ...DADOS, boletos: [] }).toString('latin1');

    expect(pdf).toContain('(Nenhum boleto até a data de emissão.)');
    expect(pdf).not.toContain('(Situação)');
  });
});

describe('csvHistorico', () => {
  it('gera uma planilha com ";", vírgula decimal e BOM', () => {
    const csv = csvHistorico([JULHO, JUNHO]).toString('utf8');

    expect(csv).toBe(
      '﻿Mês;Valor (R$);Vencimento;Situação\r\n' +
        'julho de 2099;1300,00;10/07/2099;Vencido\r\n' +
        'junho de 2099 (avulso);120,00;10/06/2099;Pago em 08/06/2099, com Pix\r\n',
    );
  });

  it('gera só o cabeçalho quando não há boleto', () => {
    expect(csvHistorico([]).toString('utf8')).toBe(
      '﻿Mês;Valor (R$);Vencimento;Situação\r\n',
    );
  });
});
