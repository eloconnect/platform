import { lerXmlJucemat, textoDoXml } from './jucemat.js';

describe('lerXmlJucemat', () => {
  it('lê cada empresa, com entidades e CDATA', () => {
    const { empresas, erros } = lerXmlJucemat(
      `<empresas><empresa><cnpj>11.222.333/0001-81</cnpj><razaoSocial><![CDATA[Farmácia A & B]]></razaoSocial><nomeFantasia>A &amp; B</nomeFantasia></empresa></empresas>`,
    );

    expect(erros).toEqual([]);
    expect(empresas).toEqual([
      {
        empresa: 1,
        cnpj: '11222333000181',
        razaoSocial: 'Farmácia A & B',
        nomeFantasia: 'A & B',
        email: null,
        telefone: null,
        municipio: null,
      },
    ]);
  });

  it('aponta o CNPJ repetido, a razão social e o e-mail', () => {
    const empresa = `<empresa><cnpj>11222333000181</cnpj><razaoSocial>A</razaoSocial></empresa>`;
    const { empresas, erros } = lerXmlJucemat(
      `<empresas>${empresa}${empresa}<empresa><cnpj>11222333000181</cnpj><email>sem-arroba</email></empresa></empresas>`,
    );

    expect(empresas).toHaveLength(1);
    expect(erros).toEqual([
      { empresa: 2, mensagem: 'CNPJ repetido no arquivo.' },
      {
        empresa: 3,
        mensagem:
          'CNPJ repetido no arquivo. Falta a razão social. E-mail inválido.',
      },
    ]);
  });

  it('avisa quando o arquivo não tem empresas', () => {
    expect(lerXmlJucemat('<outra-coisa/>').erros).toHaveLength(1);
  });
});

describe('textoDoXml', () => {
  it('usa o encoding que o XML declara', () => {
    const latin1 = Buffer.from(
      '<?xml version="1.0" encoding="ISO-8859-1"?><a>Cuiabá</a>',
      'latin1',
    );
    expect(textoDoXml(latin1)).toContain('Cuiabá');
    expect(textoDoXml(Buffer.from('﻿<a>Cuiabá</a>', 'utf8'))).toBe(
      '<a>Cuiabá</a>',
    );
  });
});
