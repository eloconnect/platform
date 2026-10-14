import {
  pdfHistoricoAssociado,
  pdfListaAssociados,
  pdfRecebimentos,
} from './relatorios-admin';

describe('relatórios administrativos em PDF', () => {
  it('gera um PDF de histórico mesmo quando não há lançamentos', async () => {
    const pdf = await pdfHistoricoAssociado({
      razaoSocial: 'Farmácia Exemplo Ltda',
      nomeFantasia: 'Farmácia Exemplo',
      cnpj: '12345678000190',
      municipio: 'Cuiabá',
      email: null,
      telefone: null,
      situacao: 'PENDENTE',
      boletos: [],
    });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('gera PDF da base estadual sem registros', async () => {
    const pdf = await pdfListaAssociados([]);

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('gera PDF de recebimentos com filtro de inadimplentes e dados de pagamento', async () => {
    const pdf = await pdfRecebimentos(
      [
        {
          razaoSocial: 'Farmácia Exemplo Ltda',
          nomeFantasia: 'Farmácia Exemplo',
          cnpj: '12345678000190',
          municipio: 'Cuiabá',
          email: 'financeiro@exemplo.com',
          telefone: '65999999999',
          situacao: 'INADIMPLENTE',
          boletos: [
            {
              competencia: new Date('2026-10-01T00:00:00.000Z'),
              pagoEm: new Date('2026-10-10T00:00:00.000Z'),
              valor: 125,
            },
          ],
        },
      ],
      { periodo: 'MES', referencia: '2026-10', inadimplentes: true },
    );

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
