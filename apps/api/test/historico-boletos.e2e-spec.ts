// Histórico de boletos e pagamentos no perfil do associado (US07: RF07) e a
// exportação em PDF e CSV (US32: RF32). Roda no banco de teste
// (preparar-banco.mjs), com boletos de 2099.
import 'dotenv/config';
import type { HistoricoBoletos } from '@eloconnect/shared';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.JWT_SECRET ??= 'segredo-so-para-teste-com-mais-de-32-caracteres';

const caminho = (id: string) => `/associados/${id}/boletos`;

describe('Histórico de boletos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;

  const http = () => request(app.getHttpServer());
  const assinar = (perfil: string) =>
    jwt.signAsync(
      { perfil },
      {
        secret: process.env.JWT_SECRET,
        subject: crypto.randomUUID(),
        expiresIn: 300,
      },
    );

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  afterAll(() => app.close());

  async function criarAssociadoComBoletos() {
    const associado = await prisma.associado.create({
      data: {
        cnpj: crypto
          .randomUUID()
          .replace(/\D/g, '')
          .padEnd(14, '0')
          .slice(0, 14),
        razaoSocial: 'Farmácia do Histórico Ltda',
      },
    });
    const boleto = (mes: string, status: 'EM_ABERTO' | 'PAGO') =>
      prisma.boleto.create({
        data: {
          associadoId: associado.id,
          tipo: 'MENSAL',
          competencia: new Date(`2099-${mes}-01`),
          valor: '120.00',
          vencimento: new Date(`2099-${mes}-10`),
          status,
          pagoEm:
            status === 'PAGO' ? new Date(`2099-${mes}-08T15:00:00Z`) : null,
        },
      });
    const junho = await boleto('06', 'PAGO');
    const julho = await boleto('07', 'EM_ABERTO');
    await prisma.transacao.create({
      data: {
        boletoId: junho.id,
        associadoId: associado.id,
        evento: 'PAGO',
        valor: '120.00',
        formaPagamento: 'PIX',
      },
    });
    return { associado, junho, julho };
  }

  it('recusa sem token (401) e para o associado (403)', async () => {
    const { associado } = await criarAssociadoComBoletos();
    const semToken = await http().get(caminho(associado.id));
    const doAssociado = await http()
      .get(caminho(associado.id))
      .set('Authorization', `Bearer ${await assinar('ASSOCIADO')}`);

    expect([semToken.status, doAssociado.status]).toEqual([401, 403]);
  });

  it.each(['ADMIN', 'ADMIN_BASICO'])(
    'o perfil %s vê os boletos, do mês mais novo para o mais antigo',
    async (perfil) => {
      const { associado, junho, julho } = await criarAssociadoComBoletos();

      const { body } = await http()
        .get(caminho(associado.id))
        .set('Authorization', `Bearer ${await assinar(perfil)}`)
        .expect(200);

      expect(body).toEqual({
        simulacao: true,
        boletos: [
          {
            id: julho.id,
            competencia: { ano: 2099, mes: 7 },
            tipo: 'MENSAL',
            valor: '120.00',
            vencimento: '2099-07-10',
            status: 'EM_ABERTO',
            vencido: false,
            pagoEm: null,
            formaPagamento: null,
          },
          expect.objectContaining({
            id: junho.id,
            status: 'PAGO',
            pagoEm: '2099-06-08T15:00:00.000Z',
            formaPagamento: 'PIX',
          }),
        ],
      } satisfies HistoricoBoletos);
    },
  );

  it('responde 404 para associado que não existe', async () => {
    await http()
      .get(caminho(crypto.randomUUID()))
      .set('Authorization', `Bearer ${await assinar('ADMIN')}`)
      .expect(404);
  });

  /** Baixa o arquivo inteiro, seja PDF ou CSV. */
  const baixar = (endereco: string, token: string) =>
    http()
      .get(endereco)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, pronto) => {
        const partes: Buffer[] = [];
        res.on('data', (parte: Buffer) => partes.push(parte));
        res.on('end', () => pronto(null, Buffer.concat(partes)));
      });

  it.each(['ADMIN', 'ADMIN_BASICO'])(
    'o perfil %s baixa o histórico em PDF e em CSV',
    async (perfil) => {
      const { associado } = await criarAssociadoComBoletos();
      const token = await assinar(perfil);

      const pdf = await baixar(`${caminho(associado.id)}/pdf`, token).expect(
        200,
      );
      const csv = await baixar(`${caminho(associado.id)}/csv`, token).expect(
        200,
      );

      expect(pdf.headers['content-type']).toBe('application/pdf');
      expect(pdf.headers['content-disposition']).toBe(
        `attachment; filename="historico-${associado.cnpj}.pdf"`,
      );
      expect(pdf.headers['cache-control']).toBe('private, no-store');
      const textoPdf = (pdf.body as Buffer).toString('latin1');
      expect(textoPdf.startsWith('%PDF-1.4')).toBe(true);
      expect(textoPdf).toContain('(Farmácia do Histórico Ltda)');
      expect(textoPdf).toContain('(Pago em 08/06/2099, com Pix)');

      expect(csv.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(csv.headers['content-disposition']).toBe(
        `attachment; filename="historico-${associado.cnpj}.csv"`,
      );
      expect((csv.body as Buffer).toString('utf8')).toBe(
        '\uFEFFMês;Valor (R$);Vencimento;Situação\r\n' +
          'julho de 2099;120,00;10/07/2099;Em aberto\r\n' +
          'junho de 2099;120,00;10/06/2099;Pago em 08/06/2099, com Pix\r\n',
      );
    },
  );

  it('na exportação, recusa o associado, o formato desconhecido e o associado que não existe', async () => {
    const { associado } = await criarAssociadoComBoletos();
    const admin = await assinar('ADMIN');

    await baixar(
      `${caminho(associado.id)}/pdf`,
      await assinar('ASSOCIADO'),
    ).expect(403);
    await baixar(`${caminho(associado.id)}/xls`, admin).expect(400);
    await baixar(`${caminho(crypto.randomUUID())}/csv`, admin).expect(404);
  });
});
