import { BadRequestException } from '@nestjs/common';
import { lerAssociadosCsv } from './associados-csv';

describe('lerAssociadosCsv', () => {
  it('lê CSV separado por ponto e vírgula, com BOM e campos opcionais', () => {
    const csv = Buffer.from(
      '\uFEFFCNPJ;Razão Social;Nome Fantasia;Município;E-mail;Telefone\r\n' +
        '12.345.678/0001-90;"Farmácia ""São João"" Ltda";São João;Cuiabá;a@b.com;65999999999',
      'utf8',
    );

    expect(lerAssociadosCsv(csv)).toEqual([
      {
        cnpj: '12345678000190',
        razaoSocial: 'Farmácia "São João" Ltda',
        nomeFantasia: 'São João',
        municipio: 'Cuiabá',
        email: 'a@b.com',
        telefone: '65999999999',
      },
    ]);
  });

  it('aceita vírgulas dentro de campos entre aspas', () => {
    const csv = Buffer.from(
      'cnpj,razaoSocial,municipio\n12345678000190,"Farmácia, Centro",Cuiabá',
    );

    expect(lerAssociadosCsv(csv)[0]?.razaoSocial).toBe('Farmácia, Centro');
  });

  it.each([
    [
      'cabeçalho sem os campos obrigatórios',
      'cnpj,nomeFantasia\n12345678000190,Farmácia',
    ],
    ['CNPJ inválido', 'cnpj,razaoSocial\n123,Farmácia'],
    [
      'CNPJ repetido',
      'cnpj,razaoSocial\n12345678000190,Farmácia A\n12.345.678/0001-90,Farmácia B',
    ],
    [
      'campo com aspas incompletas',
      'cnpj,razaoSocial\n12345678000190,"Farmácia',
    ],
  ])('rejeita %s antes de importar', (_cenario, csv) => {
    expect(() => lerAssociadosCsv(Buffer.from(csv, 'utf8'))).toThrow(
      BadRequestException,
    );
  });
});
