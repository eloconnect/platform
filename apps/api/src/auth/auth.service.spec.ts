import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { Prisma } from '../generated/prisma/client.js';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  const senha = 'senha-segura';
  const usuario = {
    id: 'usuario-id',
    email: 'associado@example.com',
    nome: 'Farmácia Exemplo',
    perfil: 'ASSOCIADO',
    senhaHash: '',
    ativo: true,
    emailConfirmadoEm: new Date(),
  };
  const findUnique = jest.fn();
  const usuarioCreate = jest.fn();
  const associadoFindUnique = jest.fn();
  const tokenFindUnique = jest.fn();
  const tokenFindFirst = jest.fn();
  const tokenCreate = jest.fn();
  const tokenUpdateMany = jest.fn();
  const usuarioUpdate = jest.fn();
  const transaction = jest.fn();
  const signAsync = jest.fn();
  const get = jest.fn();
  const send = jest.fn();

  const prisma = {
    usuario: { findUnique, create: usuarioCreate, update: usuarioUpdate },
    associado: { findUnique: associadoFindUnique },
    tokenUsuario: {
      findUnique: tokenFindUnique,
      findFirst: tokenFindFirst,
      create: tokenCreate,
      updateMany: tokenUpdateMany,
    },
    $transaction: transaction,
  };

  const service = new AuthService(
    prisma as unknown as PrismaService, // oxlint-disable-line typescript(no-unsafe-type-assertion)
    { signAsync } as unknown as JwtService, // oxlint-disable-line typescript(no-unsafe-type-assertion)
    { get } as unknown as ConfigService, // oxlint-disable-line typescript(no-unsafe-type-assertion)
    { send } as unknown as EmailService, // oxlint-disable-line typescript(no-unsafe-type-assertion)
  );

  beforeAll(async () => {
    usuario.senhaHash = await hash(senha);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    findUnique.mockResolvedValue({ ...usuario });
    signAsync.mockResolvedValue('jwt-de-acesso');
    send.mockResolvedValue(undefined);
    get.mockImplementation((chave: string) =>
      chave === 'JWT_SECRET'
        ? 'chave-segura-com-mais-de-32-caracteres'
        : chave === 'WEB_URL'
          ? 'https://app.example.com/'
          : undefined,
    );
    transaction.mockImplementation(
      (operacao: unknown) =>
        typeof operacao === 'function'
          ? (operacao as (p: typeof prisma) => unknown)(prisma) // oxlint-disable-line typescript(no-unsafe-type-assertion)
          : Promise.all(operacao as Array<Promise<unknown>>), // oxlint-disable-line typescript(no-unsafe-type-assertion)
    );
  });

  it('valida a senha Argon2id e retorna JWT sem expor o hash', async () => {
    const result = await service.login({
      email: 'associado@example.com',
      senha,
    });

    expect(usuario.senhaHash).toMatch(/^\$argon2id\$/);
    expect(signAsync).toHaveBeenCalledWith(
      { perfil: usuario.perfil },
      {
        secret: 'chave-segura-com-mais-de-32-caracteres',
        subject: usuario.id,
        expiresIn: '1h',
      },
    );
    expect(result).toEqual({
      accessToken: 'jwt-de-acesso',
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        perfil: usuario.perfil,
      },
    });
  });

  it.each([
    ['usuário inexistente', 'inexistente', 'senha-qualquer'],
    ['senha incorreta', 'ativo', 'senha-incorreta'],
    ['conta inativa', 'inativo', senha],
    ['e-mail não confirmado', 'nao-confirmado', senha],
    ['conta sem senha', 'sem-senha', senha],
  ])('recusa login com %s', async (_caso, situacao, senhaTentada) => {
    const registro =
      situacao === 'inexistente'
        ? null
        : {
            ...usuario,
            ...(situacao === 'inativo' ? { ativo: false } : {}),
            ...(situacao === 'nao-confirmado'
              ? { emailConfirmadoEm: null }
              : {}),
            ...(situacao === 'sem-senha' ? { senhaHash: null } : {}),
          };
    findUnique.mockResolvedValue(registro);

    await expect(
      service.login({
        email: 'associado@example.com',
        senha: senhaTentada,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(signAsync).not.toHaveBeenCalled();
  });

  describe('recuperação de senha', () => {
    it('grava só o hash do token e envia o link por e-mail', async () => {
      const resposta = await service.solicitarRecuperacaoSenha({
        email: usuario.email,
      });

      expect(resposta.mensagem).toContain('Se o e-mail estiver cadastrado');

      const firstCall = tokenCreate.mock.calls[0] as Array<{
        // oxlint-disable-line typescript(no-unsafe-type-assertion)
        data: { tokenHash: string; expiraEm: Date; tipo: string };
      }>;
      const data = firstCall[0].data;

      expect(data.tipo).toBe('RECUPERACAO_SENHA');
      expect(data.expiraEm.getTime()).toBeGreaterThan(Date.now());

      const emailCall = send.mock.calls[0] as Array<{
        // oxlint-disable-line typescript(no-unsafe-type-assertion)
        to: string;
        text: string;
      }>;
      const mensagem = emailCall[0];
      const token = /redefinir-senha\?token=(\S+)/.exec(mensagem.text)?.[1];
      expect(mensagem.to).toBe(usuario.email);
      expect(mensagem.text).toContain(
        'https://app.example.com/redefinir-senha?token=',
      );
      expect(token).toBeDefined();
      expect(data.tokenHash).toBe(
        createHash('sha256')
          .update(token ?? '')
          .digest('hex'),
      );
      expect(data.tokenHash).not.toBe(token);
    });

    it.each([
      ['conta inexistente', null],
      ['conta inativa', { ...usuario, ativo: false }],
      ['conta ainda sem senha', { ...usuario, emailConfirmadoEm: null }],
    ])('responde igual e não envia e-mail para %s', async (_caso, registro) => {
      findUnique.mockResolvedValue(registro);

      const resposta = await service.solicitarRecuperacaoSenha({
        email: 'outro@example.com',
      });

      expect(resposta.mensagem).toContain('Se o e-mail estiver cadastrado');
      expect(tokenCreate).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });

    it('não falha o pedido quando o envio do e-mail dá erro', async () => {
      const erro = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      send.mockRejectedValue(new Error('SMTP fora do ar'));

      await expect(
        service.solicitarRecuperacaoSenha({ email: usuario.email }),
      ).resolves.toHaveProperty('mensagem');

      await new Promise((resolve) => {
        process.nextTick(resolve);
      });

      expect(erro.mock.calls.length).toBeGreaterThan(0);
      erro.mockRestore();
    });

    describe('redefinir senha', () => {
      const token = 'token-de-teste-com-mais-de-20-caracteres';
      const registro = {
        id: 'token-id',
        usuarioId: usuario.id,
        tipo: 'RECUPERACAO_SENHA',
        usadoEm: null,
        expiraEm: new Date(Date.now() + 60_000),
        usuario: { ativo: true },
      };

      beforeEach(() => {
        tokenFindUnique.mockResolvedValue({ ...registro });
        tokenUpdateMany.mockResolvedValue({ count: 1 });
      });

      it('troca a senha por um hash Argon2id e consome o token', async () => {
        await service.redefinirSenha({ token, senha: 'nova-senha-forte' });

        expect(tokenFindUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              tokenHash: createHash('sha256').update(token).digest('hex'),
            },
          }),
        );

        const updateCall = usuarioUpdate.mock.calls[0] as Array<{
          // oxlint-disable-line typescript(no-unsafe-type-assertion)
          data: { senhaHash: string };
        }>;
        const data = updateCall[0].data;

        expect(data.senhaHash).toMatch(/^\$argon2id\$/);
        expect(await verify(data.senhaHash, 'nova-senha-forte')).toBe(true);
        expect(tokenUpdateMany).toHaveBeenCalledTimes(1);
      });

      it.each([
        ['inexistente', null],
        ['já usado', { ...registro, usadoEm: new Date() }],
        ['expirado', { ...registro, expiraEm: new Date(Date.now() - 1) }],
        ['de outro tipo', { ...registro, tipo: 'CONFIRMACAO_EMAIL' }],
        ['de conta inativa', { ...registro, usuario: { ativo: false } }],
      ])('recusa token %s', async (_caso, encontrado) => {
        tokenFindUnique.mockResolvedValue(encontrado);

        await expect(
          service.redefinirSenha({ token, senha: 'nova-senha-forte' }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(usuarioUpdate).not.toHaveBeenCalled();
      });

      it('recusa quando o token é consumido por outro pedido ao mesmo tempo', async () => {
        tokenUpdateMany.mockResolvedValue({ count: 0 });

        await expect(
          service.redefinirSenha({ token, senha: 'nova-senha-forte' }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(usuarioUpdate).not.toHaveBeenCalled();
      });
    });
  });

  describe('criação de conta pelo CNPJ', () => {
    const cnpj = '11222333000181';
    const associado = {
      id: 'associado-id',
      razaoSocial: 'Farmácia Exemplo Ltda',
      nomeFantasia: 'Drogaria Exemplo',
      email: 'Contato@Farmacia.example.com',
      inativadoEm: null,
      usuario: null,
    };
    const contaPendente = {
      id: 'conta-id',
      email: 'contato@farmacia.example.com',
      ativo: true,
      emailConfirmadoEm: null,
    };
    const MENSAGEM =
      'Se o CNPJ estiver no cadastro do sindicato, enviamos um link para o e-mail da farmácia que está no cadastro.';

    const emailEnviado = () =>
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      (send.mock.calls[0] as Array<{ to: string; text: string }>)[0];
    const tokenCriado = () =>
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      (
        tokenCreate.mock.calls[0] as Array<{
          data: { usuarioId: string; tipo: string; expiraEm: Date };
        }>
      )[0].data;

    beforeEach(() => {
      associadoFindUnique.mockResolvedValue({ ...associado });
      usuarioCreate.mockResolvedValue({ id: 'nova-conta-id' });
      tokenFindFirst.mockResolvedValue(null);
    });

    it('cria a conta sem senha e manda o link para o e-mail do cadastro', async () => {
      const resposta = await service.solicitarCriacaoConta({ cnpj });

      expect(resposta.mensagem).toBe(MENSAGEM);
      expect(associadoFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { cnpj } }),
      );
      expect(usuarioCreate).toHaveBeenCalledWith({
        data: {
          email: 'contato@farmacia.example.com',
          nome: 'Drogaria Exemplo',
          perfil: 'ASSOCIADO',
          associadoId: 'associado-id',
        },
        select: { id: true },
      });
      const token = tokenCriado();
      expect(token.usuarioId).toBe('nova-conta-id');
      expect(token.tipo).toBe('CONFIRMACAO_EMAIL');
      expect(token.expiraEm.getTime()).toBeGreaterThan(
        Date.now() + 23 * 60 * 60 * 1000,
      );
      const mensagem = emailEnviado();
      expect(mensagem.to).toBe('contato@farmacia.example.com');
      expect(mensagem.text).toContain(
        'https://app.example.com/criar-senha?token=',
      );
    });

    it.each([
      ['fora do cadastro', null],
      ['sem e-mail no cadastro', { ...associado, email: null }],
      ['inativado', { ...associado, inativadoEm: new Date() }],
    ])(
      'responde igual e não envia e-mail para associado %s',
      async (_caso, registro) => {
        associadoFindUnique.mockResolvedValue(registro);

        const resposta = await service.solicitarCriacaoConta({ cnpj });

        expect(resposta.mensagem).toBe(MENSAGEM);
        expect(usuarioCreate).not.toHaveBeenCalled();
        expect(tokenCreate).not.toHaveBeenCalled();
        expect(send).not.toHaveBeenCalled();
      },
    );

    it('não manda outro e-mail antes de 2 minutos', async () => {
      associadoFindUnique.mockResolvedValue({
        ...associado,
        usuario: contaPendente,
      });
      tokenFindFirst.mockResolvedValue({ criadoEm: new Date() });

      const resposta = await service.solicitarCriacaoConta({ cnpj });

      expect(resposta.mensagem).toBe(MENSAGEM);
      expect(tokenCreate).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });

    it('com a conta pendente, troca o e-mail se a sede mudou o cadastro', async () => {
      associadoFindUnique.mockResolvedValue({
        ...associado,
        usuario: { ...contaPendente, email: 'antigo@farmacia.example.com' },
      });
      tokenFindFirst.mockResolvedValue({
        criadoEm: new Date(Date.now() - 3 * 60 * 1000),
      });

      await service.solicitarCriacaoConta({ cnpj });

      expect(usuarioCreate).not.toHaveBeenCalled();
      expect(usuarioUpdate).toHaveBeenCalledWith({
        where: { id: 'conta-id' },
        data: { email: 'contato@farmacia.example.com' },
      });
      expect(tokenCriado().tipo).toBe('CONFIRMACAO_EMAIL');
      expect(emailEnviado().to).toBe('contato@farmacia.example.com');
    });

    it('com a conta já criada, manda o link de redefinir senha', async () => {
      associadoFindUnique.mockResolvedValue({
        ...associado,
        usuario: {
          ...contaPendente,
          email: 'dono@farmacia.example.com',
          emailConfirmadoEm: new Date(),
        },
      });

      await service.solicitarCriacaoConta({ cnpj });

      expect(usuarioCreate).not.toHaveBeenCalled();
      expect(tokenCriado().tipo).toBe('RECUPERACAO_SENHA');
      const mensagem = emailEnviado();
      expect(mensagem.to).toBe('dono@farmacia.example.com');
      expect(mensagem.text).toContain(
        'https://app.example.com/redefinir-senha?token=',
      );
    });

    it('não envia quando o e-mail já é de outra conta', async () => {
      const aviso = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      usuarioCreate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('e-mail repetido', {
          code: 'P2002',
          clientVersion: 'teste',
        }),
      );

      const resposta = await service.solicitarCriacaoConta({ cnpj });

      expect(resposta.mensagem).toBe(MENSAGEM);
      expect(tokenCreate).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
      expect(aviso).toHaveBeenCalled();
      aviso.mockRestore();
    });
  });

  describe('confirmar conta', () => {
    const token = 'token-de-teste-com-mais-de-20-caracteres';
    const registro = {
      id: 'token-id',
      usuarioId: usuario.id,
      tipo: 'CONFIRMACAO_EMAIL',
      usadoEm: null,
      expiraEm: new Date(Date.now() + 60_000),
      usuario: { ativo: true },
    };

    beforeEach(() => {
      tokenFindUnique.mockResolvedValue({ ...registro });
      tokenUpdateMany.mockResolvedValue({ count: 1 });
    });

    it('grava a senha e confirma o e-mail', async () => {
      await service.confirmarConta({ token, senha: 'senha-nova-forte' });

      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const { data } = (
        usuarioUpdate.mock.calls[0] as Array<{
          data: { senhaHash: string; emailConfirmadoEm: Date };
        }>
      )[0];
      expect(await verify(data.senhaHash, 'senha-nova-forte')).toBe(true);
      expect(data.emailConfirmadoEm).toBeInstanceOf(Date);
    });

    it('recusa o link de redefinir senha', async () => {
      tokenFindUnique.mockResolvedValue({
        ...registro,
        tipo: 'RECUPERACAO_SENHA',
      });

      await expect(
        service.confirmarConta({ token, senha: 'senha-nova-forte' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usuarioUpdate).not.toHaveBeenCalled();
    });
  });
});
