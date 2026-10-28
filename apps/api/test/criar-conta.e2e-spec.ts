// Criação de conta pelo CNPJ, com o link de criar a senha no e-mail do
// cadastro (US02 e US05: RF05, RN21). Roda no banco de teste
// (preparar-banco.mjs); os dados ficam lá, então cada teste usa CNPJs e
// e-mails novos. O envio de e-mail é trocado por um mock que guarda as
// mensagens.
import 'dotenv/config';
import { jest } from '@jest/globals';
import { cnpjValido, formatarCnpj } from '@eloconnect/shared';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { EmailService, type EmailMessage } from '../src/email/email.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.JWT_SECRET ??= 'segredo-so-para-teste-com-mais-de-32-caracteres';

const MENSAGEM =
  'Se o CNPJ estiver no cadastro do sindicato, enviamos um link para o e-mail da farmácia que está no cadastro.';

/** CNPJ numérico válido e diferente a cada chamada. */
function cnpjNovo(): string {
  const base = String(Math.floor(Math.random() * 1e12)).padStart(12, '0');
  for (let dv = 0; dv < 100; dv++) {
    const cnpj = base + String(dv).padStart(2, '0');
    if (cnpjValido(cnpj)) return cnpj;
  }
  throw new Error('Não achei os dígitos verificadores.');
}

describe('Criar conta (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const send = jest.fn<(mensagem: EmailMessage) => Promise<void>>();

  const http = () => request(app.getHttpServer());
  const enviados = () => send.mock.calls.map(([mensagem]) => mensagem);
  const tokenDo = (mensagem: EmailMessage) =>
    /criar-senha\?token=(\S+)/.exec(mensagem.text)?.[1] ?? '';

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue({ send })
      .compile();
    app = modulo.createNestApplication();
    // Mesma validação do main.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue(undefined);
  });

  afterAll(() => app.close());

  async function associadoNovo(dados: { inativadoEm?: Date } = {}) {
    const sufixo = crypto.randomUUID();
    return prisma.associado.create({
      data: {
        cnpj: cnpjNovo(),
        razaoSocial: 'Farmácia Conta Ltda',
        email: `Farmacia-${sufixo}@Example.com`,
        ...dados,
      },
    });
  }

  it('recusa CNPJ inválido (400)', async () => {
    await http()
      .post('/auth/criar-conta')
      .send({ cnpj: '11.111.111/1111-11' })
      .expect(400);
    expect(send).not.toHaveBeenCalled();
  });

  it('com CNPJ fora do cadastro, responde igual e não envia e-mail', async () => {
    const resposta = await http()
      .post('/auth/criar-conta')
      .send({ cnpj: cnpjNovo() })
      .expect(200);

    expect(resposta.body).toEqual({ mensagem: MENSAGEM });
    expect(send).not.toHaveBeenCalled();
  });

  it('com associado inativado, responde igual e não envia e-mail', async () => {
    const associado = await associadoNovo({ inativadoEm: new Date() });

    await http()
      .post('/auth/criar-conta')
      .send({ cnpj: associado.cnpj })
      .expect(200, { mensagem: MENSAGEM });
    expect(send).not.toHaveBeenCalled();
  });

  it('cria a conta pelo link do e-mail e entra com e-mail e senha', async () => {
    const associado = await associadoNovo();
    const email = associado.email!.toLowerCase();

    await http()
      .post('/auth/criar-conta')
      .send({ cnpj: formatarCnpj(associado.cnpj) })
      .expect(200, { mensagem: MENSAGEM });

    expect(enviados()).toHaveLength(1);
    const [mensagem] = enviados();
    expect(mensagem.to).toBe(email);
    const token = tokenDo(mensagem);
    expect(token).not.toBe('');

    // Antes de criar a senha, a conta não entra.
    await http()
      .post('/auth/login')
      .send({ email, senha: 'senha-forte-123' })
      .expect(401);

    await http()
      .post('/auth/confirmar-conta')
      .send({ token, senha: 'senha-forte-123' })
      .expect(200);

    const login = await http()
      .post('/auth/login')
      .send({ email, senha: 'senha-forte-123' })
      .expect(200);
    expect(login.body).toMatchObject({
      usuario: { email, perfil: 'ASSOCIADO', nome: 'Farmácia Conta Ltda' },
    });

    // O link é de uso único.
    await http()
      .post('/auth/confirmar-conta')
      .send({ token, senha: 'outra-senha-123' })
      .expect(400);
  });

  it('não manda outro e-mail antes de 2 minutos', async () => {
    const associado = await associadoNovo();

    await http()
      .post('/auth/criar-conta')
      .send({ cnpj: associado.cnpj })
      .expect(200);
    await http()
      .post('/auth/criar-conta')
      .send({ cnpj: associado.cnpj })
      .expect(200, { mensagem: MENSAGEM });

    expect(enviados()).toHaveLength(1);
  });

  it('a conta ainda sem senha não recebe o link de esqueci a senha', async () => {
    const associado = await associadoNovo();
    await http()
      .post('/auth/criar-conta')
      .send({ cnpj: associado.cnpj })
      .expect(200);

    send.mockReset();
    await http()
      .post('/auth/esqueci-senha')
      .send({ email: associado.email!.toLowerCase() })
      .expect(200);
    expect(send).not.toHaveBeenCalled();
  });
});
