import { ForbiddenException } from '@nestjs/common';
import { AssociateStatus, CancellationStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { MemberService } from './member.service';

describe('MemberService', () => {
  const associate = {
    id: 'associate-1',
    userId: 'member-1',
    status: AssociateStatus.ADIMPLENTE,
    recurringBilling: true,
    manuallyBlocked: false,
  };
  const transaction = {
    associate: { updateMany: jest.fn() },
    cancellationRequest: { create: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    associate: { findUnique: jest.fn() },
    benefit: { findMany: jest.fn() },
    convention: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  let service: MemberService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MemberService(prisma as unknown as PrismaService);
  });

  it('prevents a cancelled member from reading active benefits', async () => {
    prisma.associate.findUnique.mockResolvedValue({
      ...associate,
      status: AssociateStatus.CANCELADO,
    });

    await expect(service.getBenefits(associate.userId)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.benefit.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ['inadimplente', AssociateStatus.INADIMPLENTE, false],
    ['blocked manually', AssociateStatus.ADIMPLENTE, true],
  ])(
    'prevents a %s member from reading active benefits',
    async (_, status, manuallyBlocked) => {
      prisma.associate.findUnique.mockResolvedValue({
        ...associate,
        status,
        manuallyBlocked,
      });

      await expect(service.getBenefits(associate.userId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.benefit.findMany).not.toHaveBeenCalled();
    },
  );

  it('returns only general convention information to an inadimplente member', async () => {
    prisma.associate.findUnique.mockResolvedValue({
      ...associate,
      status: AssociateStatus.INADIMPLENTE,
    });
    prisma.convention.findMany.mockResolvedValue([
      {
        id: 'convention-1',
        title: 'Convenção coletiva',
        attachments: [{ id: 'attachment-1', fileName: 'convention.pdf' }],
        salaryScales: [
          {
            id: 'salary-scale-1',
            jobTitle: 'Farmacêutico',
            floorAmount: '3850.50',
          },
        ],
      },
    ]);

    await expect(service.getConventions(associate.userId)).resolves.toEqual([
      expect.objectContaining({
        id: 'convention-1',
        title: 'Convenção coletiva',
        attachments: [],
        salaryScales: [
          expect.objectContaining({
            id: 'salary-scale-1',
            jobTitle: 'Farmacêutico',
            floorAmount: 3850.5,
          }),
        ],
      }),
    ]);
  });

  it('prevents a cancelled member from reading conventions', async () => {
    prisma.associate.findUnique.mockResolvedValue({
      ...associate,
      status: AssociateStatus.CANCELADO,
    });

    await expect(service.getConventions(associate.userId)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.convention.findMany).not.toHaveBeenCalled();
  });

  it('immediately deactivates membership and records cancellation and audit atomically', async () => {
    prisma.associate.findUnique.mockResolvedValue(associate);
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
    transaction.associate.updateMany.mockResolvedValue({ count: 1 });
    transaction.cancellationRequest.create.mockResolvedValue({
      id: 'cancellation-1',
      status: CancellationStatus.EFETIVADO,
    });
    transaction.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    await expect(
      service.requestCancellation(associate.userId, true),
    ).resolves.toMatchObject({ status: AssociateStatus.CANCELADO });

    expect(transaction.associate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: associate.id,
          status: { not: AssociateStatus.CANCELADO },
        },
        data: {
          status: AssociateStatus.CANCELADO,
          recurringBilling: false,
        },
      }),
    );
    expect(transaction.cancellationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          associateId: associate.id,
          status: CancellationStatus.EFETIVADO,
          decisionNote: 'Desativada pelo associado conforme solicitação.',
        },
      }),
    );
    expect(transaction.auditLog.create).toHaveBeenCalled();
  });

  it('requires explicit cancellation confirmation', async () => {
    await expect(
      service.requestCancellation(associate.userId, false),
    ).rejects.toThrow('Confirme que compreendeu');
    expect(prisma.associate.findUnique).not.toHaveBeenCalled();
  });
});
