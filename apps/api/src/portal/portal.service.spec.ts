import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PortalService } from './portal.service';

describe('PortalService benefits access', () => {
  const findFarmacia = jest.fn();
  const findBeneficios = jest.fn();
  const findConvencao = jest.fn();
  const upsertInscricao = jest.fn();
  const createSolicitacao = jest.fn();
  let service: PortalService;
  const conta = { associadoId: 'associado-1', usuarioId: 'usuario-1' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PortalService,
        {
          provide: PrismaService,
          useValue: {
            associado: { findUnique: findFarmacia },
            beneficio: { findMany: findBeneficios },
            convencao: { findFirst: findConvencao },
            inscricaoConvencao: { upsert: upsertInscricao },
            solicitacaoSuporte: { create: createSolicitacao },
          },
        },
      ],
    }).compile();
    service = module.get(PortalService);
  });

  it('denies benefits to an associate who is not up to date', async () => {
    findFarmacia.mockResolvedValue({
      situacao: 'INADIMPLENTE',
      acessoManual: null,
    });

    await expect(service.beneficios(conta)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(findBeneficios).not.toHaveBeenCalled();
  });

  it('denies benefits when the seat has manually blocked access', async () => {
    findFarmacia.mockResolvedValue({
      situacao: 'ADIMPLENTE',
      acessoManual: 'BLOQUEADO',
    });

    await expect(service.beneficios(conta)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(findBeneficios).not.toHaveBeenCalled();
  });

  it('returns benefits to an associate in good standing', async () => {
    const beneficios = [{ id: 'beneficio-1', titulo: 'Suporte jurídico' }];
    findFarmacia.mockResolvedValue({
      situacao: 'ADIMPLENTE',
      acessoManual: null,
    });
    findBeneficios.mockResolvedValue(beneficios);

    await expect(service.beneficios(conta)).resolves.toEqual(beneficios);
  });

  it('registers a convention signup for an eligible associate', async () => {
    const inscricao = { inscritaEm: new Date('2026-01-01T12:00:00Z') };
    findFarmacia.mockResolvedValue({
      situacao: 'ADIMPLENTE',
      acessoManual: null,
    });
    findConvencao.mockResolvedValue({ id: 'convencao-1' });
    upsertInscricao.mockResolvedValue(inscricao);

    await expect(
      service.inscreverConvencao(conta, 'convencao-1'),
    ).resolves.toEqual(inscricao);
    expect(upsertInscricao).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          associadoId_convencaoId: {
            associadoId: 'associado-1',
            convencaoId: 'convencao-1',
          },
        },
      }),
    );
  });

  it('denies convention signup to an associate who is not up to date', async () => {
    findFarmacia.mockResolvedValue({
      situacao: 'INADIMPLENTE',
      acessoManual: null,
    });

    await expect(
      service.inscreverConvencao(conta, 'convencao-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findConvencao).not.toHaveBeenCalled();
    expect(upsertInscricao).not.toHaveBeenCalled();
  });

  it('records a support request from an eligible associate', async () => {
    const solicitacao = {
      id: 'solicitacao-1',
      status: 'RECEBIDA',
      criadaEm: new Date('2026-01-01T12:00:00Z'),
    };
    findFarmacia.mockResolvedValue({
      situacao: 'ADIMPLENTE',
      acessoManual: null,
    });
    createSolicitacao.mockResolvedValue(solicitacao);

    await expect(
      service.solicitarSuporte(conta, '  Preciso de orientação.  '),
    ).resolves.toEqual(solicitacao);
    expect(createSolicitacao).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          associadoId: 'associado-1',
          usuarioId: 'usuario-1',
          mensagem: 'Preciso de orientação.',
          status: 'RECEBIDA',
        }),
      }),
    );
  });
});
