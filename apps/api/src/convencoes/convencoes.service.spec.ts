import { jest } from '@jest/globals';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConvencoesService } from './convencoes.service.js';

describe('ConvencoesService', () => {
  const prisma = {
    usuario: {
      findUnique: jest.fn(),
    },
    convencao: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const auditoria = {};
  const armazenamento = {
    obter: jest.fn(),
    salvar: jest.fn(),
    excluir: jest.fn(),
  };

  let service: ConvencoesService;

  const usuarioAdimplente = {
    ativo: true,
    perfil: 'ASSOCIADO',
    associado: {
      situacao: 'ADIMPLENTE',
      contribuicaoAtiva: true,
      acessoManual: null,
      acessoManualAte: null,
      inativadoEm: null,
    },
  };

  const convencaoPublicada = {
    id: 'convencao-1',
    anexos: [
      {
        nomeArquivo: 'convencao-integral.pdf',
        arquivoUrl: 'convencoes/convencao-1/integral.pdf',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new ConvencoesService(
      prisma as any,
      auditoria as any,
      armazenamento as any,
    );
  });

  describe('listarParaAssociado', () => {
    it('lista somente convenções publicadas para associado ativo', async () => {
      prisma.usuario.findUnique.mockResolvedValue(usuarioAdimplente as any);
      prisma.convencao.findMany.mockResolvedValue([] as any);

      await expect(service.listarParaAssociado('usuario-1')).resolves.toEqual(
        [],
      );

      expect(prisma.convencao.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            publicadaEm: { not: null },
          },
        }),
      );
    });

    it('bloqueia usuário inexistente', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      await expect(
        service.listarParaAssociado('usuario-inexistente'),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.convencao.findMany).not.toHaveBeenCalled();
    });

    it('bloqueia usuário desativado', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        ...usuarioAdimplente,
        ativo: false,
      } as any);

      await expect(service.listarParaAssociado('usuario-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('bloqueia usuário que não seja associado', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        ...usuarioAdimplente,
        perfil: 'ADMIN',
      } as any);

      await expect(service.listarParaAssociado('usuario-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('bloqueia associado inativado', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        ...usuarioAdimplente,
        associado: {
          ...usuarioAdimplente.associado,
          inativadoEm: new Date(),
        },
      } as any);

      await expect(service.listarParaAssociado('usuario-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('obterAnexoAssociado', () => {
    it('permite PDF integral para associado adimplente com contribuição ativa', async () => {
      prisma.usuario.findUnique.mockResolvedValue(usuarioAdimplente as any);
      prisma.convencao.findFirst.mockResolvedValue(convencaoPublicada as any);

      const stream = {} as ReadableStream<Uint8Array>;

      armazenamento.obter.mockResolvedValue({
        stream,
        contentType: 'application/pdf',
      } as any);

      const resultado = await service.obterAnexoAssociado(
        'usuario-1',
        'convencao-1',
        'INTEGRAL',
      );

      expect(prisma.convencao.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'convencao-1',
            publicadaEm: { not: null },
          },
        }),
      );

      expect(armazenamento.obter).toHaveBeenCalledWith(
        convencaoPublicada.anexos[0].arquivoUrl,
      );

      expect(resultado).toEqual({
        stream,
        contentType: 'application/pdf',
        nomeArquivo: 'convencao-integral.pdf',
      });
    });

    it('entrega o PDF resumido ao inadimplente que solicita o integral', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        ...usuarioAdimplente,
        associado: {
          ...usuarioAdimplente.associado,
          situacao: 'INADIMPLENTE',
        },
      } as any);

      prisma.convencao.findFirst.mockResolvedValue({
        id: 'convencao-1',
        anexos: [
          {
            nomeArquivo: 'convencao-resumida.pdf',
            arquivoUrl: 'convencoes/convencao-1/resumida.pdf',
          },
        ],
      } as any);

      armazenamento.obter.mockResolvedValue({
        stream: {} as ReadableStream<Uint8Array>,
        contentType: 'application/pdf',
      } as any);

      const resultado = await service.obterAnexoAssociado(
        'usuario-1',
        'convencao-1',
        'INTEGRAL',
      );

      expect(prisma.convencao.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            anexos: expect.objectContaining({
              where: { tipo: 'RESUMIDA' },
            }),
          }),
        }),
      );

      expect(resultado.nomeArquivo).toBe('convencao-resumida.pdf');
    });

    it('entrega PDF resumido para adimplente sem contribuição ativa', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        ...usuarioAdimplente,
        associado: {
          ...usuarioAdimplente.associado,
          contribuicaoAtiva: false,
        },
      } as any);

      prisma.convencao.findFirst.mockResolvedValue({
        id: 'convencao-1',
        anexos: [
          {
            nomeArquivo: 'convencao-resumida.pdf',
            arquivoUrl: 'convencoes/convencao-1/resumida.pdf',
          },
        ],
      } as any);

      armazenamento.obter.mockResolvedValue({
        stream: {} as ReadableStream<Uint8Array>,
        contentType: 'application/pdf',
      } as any);

      const resultado = await service.obterAnexoAssociado(
        'usuario-1',
        'convencao-1',
        'INTEGRAL',
      );

      expect(prisma.convencao.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            anexos: expect.objectContaining({
              where: { tipo: 'RESUMIDA' },
            }),
          }),
        }),
      );

      expect(resultado.nomeArquivo).toBe('convencao-resumida.pdf');
    });

    it('entrega PDF resumido mesmo com liberação manual vigente para inadimplente', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        ...usuarioAdimplente,
        associado: {
          ...usuarioAdimplente.associado,
          situacao: 'INADIMPLENTE',
          acessoManual: 'LIBERADO',
          acessoManualAte: new Date(Date.now() + 60_000),
        },
      } as any);

      prisma.convencao.findFirst.mockResolvedValue({
        id: 'convencao-1',
        anexos: [
          {
            nomeArquivo: 'convencao-resumida.pdf',
            arquivoUrl: 'convencoes/convencao-1/resumida.pdf',
          },
        ],
      } as any);

      armazenamento.obter.mockResolvedValue({
        stream: {} as ReadableStream<Uint8Array>,
        contentType: 'application/pdf',
      } as any);

      const resultado = await service.obterAnexoAssociado(
        'usuario-1',
        'convencao-1',
        'INTEGRAL',
      );

      expect(prisma.convencao.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            anexos: expect.objectContaining({
              where: { tipo: 'RESUMIDA' },
            }),
          }),
        }),
      );

      expect(resultado.nomeArquivo).toBe('convencao-resumida.pdf');
    });

    it('bloqueia associado inativado', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        ...usuarioAdimplente,
        associado: {
          ...usuarioAdimplente.associado,
          inativadoEm: new Date(),
        },
      } as any);

      await expect(
        service.obterAnexoAssociado('usuario-1', 'convencao-1', 'INTEGRAL'),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.convencao.findFirst).not.toHaveBeenCalled();
    });

    it('bloqueia usuário desativado', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        ...usuarioAdimplente,
        ativo: false,
      } as any);

      await expect(
        service.obterAnexoAssociado('usuario-1', 'convencao-1', 'INTEGRAL'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('retorna não encontrado para convenção não publicada', async () => {
      prisma.usuario.findUnique.mockResolvedValue(usuarioAdimplente as any);
      prisma.convencao.findFirst.mockResolvedValue(null);

      await expect(
        service.obterAnexoAssociado('usuario-1', 'convencao-1', 'INTEGRAL'),
      ).rejects.toThrow(NotFoundException);
    });

    it('retorna não encontrado quando o PDF não existe', async () => {
      prisma.usuario.findUnique.mockResolvedValue(usuarioAdimplente as any);
      prisma.convencao.findFirst.mockResolvedValue({
        id: 'convencao-1',
        anexos: [],
      } as any);

      await expect(
        service.obterAnexoAssociado('usuario-1', 'convencao-1', 'INTEGRAL'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('atualizarAnexos', () => {
    it('rejeita quando nenhum PDF é enviado', async () => {
      await expect(
        service.atualizarAnexos('admin-1', 'convencao-1', {}),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.convencao.findUnique).not.toHaveBeenCalled();
    });

    it('rejeita arquivo que não seja PDF', async () => {
      await expect(
        service.atualizarAnexos('admin-1', 'convencao-1', {
          integral: {
            mimetype: 'text/plain',
            buffer: Buffer.from('arquivo'),
            size: 8,
            originalname: 'arquivo.txt',
          },
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.convencao.findUnique).not.toHaveBeenCalled();
      expect(armazenamento.salvar).not.toHaveBeenCalled();
    });

    it('rejeita arquivo sem assinatura PDF válida', async () => {
      await expect(
        service.atualizarAnexos('admin-1', 'convencao-1', {
          integral: {
            mimetype: 'application/pdf',
            buffer: Buffer.from('texto que não é PDF'),
            size: 20,
            originalname: 'arquivo.pdf',
          },
        }),
      ).rejects.toThrow(BadRequestException);

      expect(armazenamento.salvar).not.toHaveBeenCalled();
    });

    it('rejeita PDF maior que 4 MB', async () => {
      await expect(
        service.atualizarAnexos('admin-1', 'convencao-1', {
          integral: {
            mimetype: 'application/pdf',
            buffer: Buffer.from('%PDF-'),
            size: 4 * 1024 * 1024 + 1,
            originalname: 'arquivo.pdf',
          },
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.convencao.findUnique).not.toHaveBeenCalled();
      expect(armazenamento.salvar).not.toHaveBeenCalled();
    });
  });
});
