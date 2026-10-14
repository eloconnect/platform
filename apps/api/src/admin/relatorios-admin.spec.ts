import { pdfHistoricoAssociado, pdfListaAssociados } from './relatorios-admin';

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
});
