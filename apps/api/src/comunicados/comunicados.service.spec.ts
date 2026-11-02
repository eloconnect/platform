import { montarMensagem } from './comunicados.service.js';

describe('montarMensagem (RN19)', () => {
  it('acrescenta ao texto da sede o valor e os benefícios, por grupo', () => {
    const mensagem = montarMensagem('Texto da sede.', '120.00', [
      { titulo: 'Consultoria tributária', grupo: 'CONSULTORIA' },
      { titulo: 'Orientação trabalhista', grupo: 'ASSESSORIA_JURIDICA' },
      { titulo: 'Revisão de contratos', grupo: 'ASSESSORIA_JURIDICA' },
    ]);

    expect(mensagem).toBe(
      [
        'Texto da sede.',
        '',
        // O real vem com espaço que não quebra a linha.
        'Valor da contribuição: R$ 120,00 por mês.',
        '',
        'Benefícios de quem contribui:',
        '',
        'Assessoria jurídica',
        '- Orientação trabalhista',
        '- Revisão de contratos',
        '',
        'Consultoria',
        '- Consultoria tributária',
      ].join('\n'),
    );
  });

  it('sem benefício cadastrado, traz só o valor', () => {
    expect(montarMensagem('Texto.', '99.90', [])).toBe(
      'Texto.\n\nValor da contribuição: R$ 99,90 por mês.',
    );
  });
});
