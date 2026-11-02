import { planilhaModelo } from '@eloconnect/shared';
import { lerPlanilha, textoDoArquivo } from './planilha.js';

const CABECALHO =
  'CNPJ;Razão social;Nome fantasia;E-mail;Telefone;Município;Recebe boleto mensal';

const planilha = (...linhas: string[]) =>
  [CABECALHO, ...linhas].join('\r\n') + '\r\n';

describe('lerPlanilha (RF42)', () => {
  it('lê a planilha modelo preenchida, com o CNPJ sem pontuação', () => {
    const { linhas, erros } = lerPlanilha(
      planilha(
        '11.222.333/0001-81;Farmácia Um Ltda;Drogaria Um;um@example.com;(65) 90000-0001;Cuiabá;sim',
        '98765432000198;Farmácia Dois Ltda;;;;;não',
      ),
    );

    expect(erros).toEqual([]);
    expect(linhas).toEqual([
      {
        linha: 2,
        cnpj: '11222333000181',
        razaoSocial: 'Farmácia Um Ltda',
        nomeFantasia: 'Drogaria Um',
        email: 'um@example.com',
        telefone: '(65) 90000-0001',
        municipio: 'Cuiabá',
        contribuicaoAtiva: true,
      },
      {
        linha: 3,
        cnpj: '98765432000198',
        razaoSocial: 'Farmácia Dois Ltda',
        nomeFantasia: null,
        email: null,
        telefone: null,
        municipio: null,
        contribuicaoAtiva: false,
      },
    ]);
  });

  it('aceita o modelo baixado, a vírgula como separador e os campos entre aspas', () => {
    const modelo = planilhaModelo().replace(/\r\n$/, '');
    expect(
      lerPlanilha(`${modelo}\r\n11222333000181;Farmácia;;;;;S`).linhas,
    ).toHaveLength(1);

    const { linhas, erros } = lerPlanilha(
      [
        'cnpj,razao social,nome fantasia,e-mail,telefone,municipio,recebe boleto mensal',
        '11222333000181,"Farmácia ""Central"", Ltda",,,,,Sim',
        '',
        ',,,,,,',
      ].join('\n'),
    );

    expect(erros).toEqual([]);
    // As linhas vazias ficam de fora.
    expect(linhas).toEqual([
      expect.objectContaining({
        razaoSocial: 'Farmácia "Central", Ltda',
        contribuicaoAtiva: true,
      }),
    ]);
  });

  it('aponta cada linha com problema', () => {
    const { erros } = lerPlanilha(
      planilha(
        '11222333000181;Farmácia Um Ltda;;;;;sim',
        '11222333000100;Farmácia Dois Ltda;;;;;sim',
        '11.222.333/0001-81;Farmácia Três Ltda;;;;;sim',
        ';;;email-sem-arroba;;;talvez',
      ),
    );

    expect(erros).toEqual([
      { linha: 3, mensagem: 'CNPJ inválido.' },
      { linha: 4, mensagem: 'CNPJ repetido: já está na linha 2.' },
      {
        linha: 5,
        mensagem:
          'Falta o CNPJ. Falta a razão social. E-mail inválido. Em "Recebe boleto mensal", escreva sim ou não.',
      },
    ]);
  });

  it('pede o cabeçalho da planilha modelo e ao menos uma farmácia', () => {
    expect(lerPlanilha('CNPJ;Nome\r\n11222333000181;X').erros).toEqual([
      {
        linha: 1,
        mensagem: expect.stringContaining(
          'A primeira linha precisa ser o cabeçalho da planilha modelo',
        ),
      },
    ]);
    expect(lerPlanilha(planilha()).erros).toEqual([
      { linha: 2, mensagem: 'A planilha não tem nenhuma farmácia.' },
    ]);
  });
});

describe('textoDoArquivo', () => {
  it('lê o CSV do Excel em UTF-8 ou em Windows-1252', () => {
    expect(textoDoArquivo(Buffer.from('Município', 'utf8'))).toBe('Município');
    expect(textoDoArquivo(Buffer.from('Município', 'latin1'))).toBe(
      'Município',
    );
  });
});
