// Boletos do associado logado (US12: RF12, RN06). Roda no banco de teste
// (preparar-banco.mjs). Os boletos vencem em 2099, para não entrarem nas
// tarefas de outros testes.
import 'dotenv/config';
import type { BoletoEmAberto } from '@eloconnect/shared';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { BoletosAssociadoService } from '../src/cobranca/boletos-associado.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.JWT_SECRET ??= 'segredo-so-para-teste-com-mais-de-32-caracteres';

describe('Meus boletos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;

  const http = () => request(app.getHttpServer());
  const assinar = (perfil: string, sub: string) =>
    jwt.signAsync(
      { perfil },
      { subject: sub, secret: process.env.JWT_SECRET, expiresIn: '1h' },
    );

  /** Associado com conta e token, e os boletos dele. */
  async function criarAssociado() {
    const marcador = crypto.randomUUID();
    const associado = await prisma.associado.create({
      data: {
        cnpj: marcador.replace(/\D/g, '').padEnd(14, '0').slice(0, 14),
        razaoSocial: 'Farmácia dos Boletos Ltda',
      },
    });
    const usuario = await prisma.usuario.create({
      data: {
        email: `meus-boletos-${marcador}@example.com`,
        nome: 'Responsável',
        perfil: 'ASSOCIADO',
        senhaHash: 'x',
        associadoId: associado.id,
      },
    });
    return {
      associado,
      usuario,
      token: await assinar('ASSOCIADO', usuario.id),
    };
  }

  function criarBoleto(
    associadoId: string,
    mes: number,
    status: 'EM_ABERTO' | 'PAGO' | 'RASCUNHO' = 'EM_ABERTO',
  ) {
    const doisDigitos = String(mes).padStart(2, '0');
    const emitido = status !== 'RASCUNHO';
    const nossoNumero = `E2E${crypto.randomUUID().replace(/\D/g, '').slice(0, 12)}`;
    return prisma.boleto.create({
      data: {
        associadoId,
        tipo: 'MENSAL',
        competencia: new Date(`2099-${doisDigitos}-01`),
        valor: '130.00',
        vencimento: new Date(`2099-${doisDigitos}-10`),
        status,
        sicrediNossoNumero: emitido ? nossoNumero : null,
        linhaDigitavel: emitido ? `74891.00000 linha-${doisDigitos}` : null,
        pixCopiaECola: emitido ? `00020101-pix-${nossoNumero}` : null,
      },
    });
  }

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

  it('recusa sem token (401) e para a sede (403)', async () => {
    const admin = await assinar('ADMIN', crypto.randomUUID());

    await http().get('/associado/boletos').expect(401);
    await http()
      .get('/associado/boletos')
      .set('Authorization', `Bearer ${admin}`)
      .expect(403);
  });

  it('mostra só os boletos em aberto do próprio associado, do mais antigo ao mais novo', async () => {
    const { associado, token } = await criarAssociado();
    const outro = await criarAssociado();
    const julho = await criarBoleto(associado.id, 7);
    const junho = await criarBoleto(associado.id, 6);
    await criarBoleto(associado.id, 5, 'PAGO');
    await criarBoleto(associado.id, 8, 'RASCUNHO');
    await criarBoleto(outro.associado.id, 6);

    const { body } = await http()
      .get('/associado/boletos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body).toEqual([
      {
        id: junho.id,
        competencia: { ano: 2099, mes: 6 },
        valor: '130.00',
        vencimento: '2099-06-10',
        validoAte: '2099-07-10',
        vencido: false,
        linhaDigitavel: '74891.00000 linha-06',
        pixCopiaECola: junho.pixCopiaECola,
      },
      expect.objectContaining({ id: julho.id, vencimento: '2099-07-10' }),
    ] satisfies BoletoEmAberto[]);
  });

  it('o boleto vence no fim do dia 10, no horário de Mato Grosso', async () => {
    const { associado, usuario } = await criarAssociado();
    await criarBoleto(associado.id, 6);
    const boletos = app.get(BoletosAssociadoService);

    // 10 de junho, 23h30 em Mato Grosso: ainda no prazo.
    const [noDia] = await boletos.listar(
      usuario.id,
      new Date('2099-06-11T03:30:00Z'),
    );
    // 11 de junho, 0h30 em Mato Grosso: vencido.
    const [depois] = await boletos.listar(
      usuario.id,
      new Date('2099-06-11T04:30:00Z'),
    );
    expect([noDia.vencido, depois.vencido]).toEqual([false, true]);
  });

  it('entrega o PDF do próprio boleto em aberto', async () => {
    const { associado, token } = await criarAssociado();
    const outro = await criarAssociado();
    const junho = await criarBoleto(associado.id, 6);
    const pago = await criarBoleto(associado.id, 5, 'PAGO');
    const deOutro = await criarBoleto(outro.associado.id, 6);
    const pdf = (id: string) =>
      http()
        .get(`/associado/boletos/${id}/pdf`)
        .set('Authorization', `Bearer ${token}`);

    const resposta = await pdf(junho.id)
      .buffer(true)
      .parse((res, pronto) => {
        const partes: Buffer[] = [];
        res.on('data', (parte: Buffer) => partes.push(parte));
        res.on('end', () => pronto(null, Buffer.concat(partes)));
      })
      .expect(200);
    expect(resposta.headers['content-type']).toBe('application/pdf');
    expect(resposta.headers['content-disposition']).toBe(
      'attachment; filename="boleto-2099-06.pdf"',
    );
    expect(resposta.headers['cache-control']).toBe('private, no-store');
    const corpo = resposta.body as Buffer;
    expect(corpo.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');

    await pdf(pago.id).expect(404);
    await pdf(deOutro.id).expect(404);
    await pdf('nao-e-um-id').expect(400);
  });
});
