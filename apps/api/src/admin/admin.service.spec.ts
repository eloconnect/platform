import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  ContributionProposalStatus,
  RegistrationStatus,
  UserRole,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  MailerService,
  WelcomeEmailDeliveryError,
} from '../auth/mailer.service';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  const proposal = {
    id: 'proposal-1',
    monthlyAmount: 200,
    annualAmount: 1920,
    annualDiscountPercent: 20,
    effectiveFrom: new Date('2027-01-01T00:00:00.000Z'),
    status: ContributionProposalStatus.PENDING_HOMOLOGATION,
    note: 'Proposta anual',
    submittedAt: new Date('2026-10-12T00:00:00.000Z'),
    submittedByUserId: 'admin-1',
    reviewedAt: null,
    reviewedByUserId: null,
  };
  const transaction = {
    user: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    convention: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    contributionProposal: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    contributionValue: { create: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    user: { findMany: jest.fn(), findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const mailer = { sendWelcome: jest.fn() };
  let service: AdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminService(
      prisma as unknown as PrismaService,
      mailer as unknown as MailerService,
    );
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
  });

  it('stores annual value as a proposal with next-year effective date', async () => {
    transaction.contributionProposal.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        id: 'proposal-1',
        status: ContributionProposalStatus.PENDING_HOMOLOGATION,
        submittedAt: proposal.submittedAt,
      }),
    );
    transaction.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    await expect(
      service.createContributionProposal('admin-1', {
        annualAmount: 1776,
        note: 'Reajuste deliberado pela administração',
      }),
    ).resolves.toMatchObject({
      annualAmount: 1776,
      monthlyAmount: 185,
      status: ContributionProposalStatus.PENDING_HOMOLOGATION,
    });

    const [createCall] = transaction.contributionProposal.create.mock
      .calls[0] as [{ data: Record<string, unknown> }];
    const effectiveFrom = createCall.data.effectiveFrom as Date;
    expect(effectiveFrom).toEqual(
      new Date(Date.UTC(new Date().getUTCFullYear() + 1, 0, 1)),
    );
    expect(createCall.data).toMatchObject({
      annualAmount: 1776,
      monthlyAmount: 185,
      annualDiscountPercent: 20,
    });
    expect(transaction.contributionValue.create).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).toHaveBeenCalled();
  });

  it('only creates a scheduled contribution value after homologation is recorded', async () => {
    transaction.contributionProposal.findUnique.mockResolvedValue(proposal);
    transaction.contributionProposal.updateMany.mockResolvedValue({ count: 1 });
    transaction.contributionValue.create.mockResolvedValue({
      id: 'contribution-next-year',
    });
    transaction.auditLog.create.mockResolvedValue({ id: 'audit-2' });

    await expect(
      service.decideContributionProposal('admin-1', proposal.id, {
        decision: 'APPROVED',
        note: 'Aprovado em reunião da diretoria',
      }),
    ).resolves.toEqual({
      id: proposal.id,
      status: ContributionProposalStatus.APPROVED,
    });
    expect(transaction.contributionValue.create).toHaveBeenCalledWith({
      data: {
        monthlyAmount: proposal.monthlyAmount,
        annualAmount: proposal.annualAmount,
        effectiveFrom: proposal.effectiveFrom,
        createdByUserId: 'admin-1',
      },
    });
  });

  it('does not apply the proposed contribution when homologation is rejected', async () => {
    transaction.contributionProposal.findUnique.mockResolvedValue(proposal);
    transaction.contributionProposal.updateMany.mockResolvedValue({ count: 1 });
    transaction.auditLog.create.mockResolvedValue({ id: 'audit-3' });

    await service.decideContributionProposal('admin-1', proposal.id, {
      decision: 'REJECTED',
      note: 'Aguardando nova proposta',
    });

    expect(transaction.contributionValue.create).not.toHaveBeenCalled();
  });

  it('rejects decisions for missing or already resolved proposals', async () => {
    transaction.contributionProposal.findUnique.mockResolvedValue(null);
    await expect(
      service.decideContributionProposal('admin-1', proposal.id, {
        decision: 'APPROVED',
      }),
    ).rejects.toThrow(NotFoundException);

    transaction.contributionProposal.findUnique.mockResolvedValue({
      ...proposal,
      status: ContributionProposalStatus.REJECTED,
    });
    await expect(
      service.decideContributionProposal('admin-1', proposal.id, {
        decision: 'APPROVED',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('saves and returns convention salary floors as numeric values', async () => {
    const now = new Date('2026-10-12T00:00:00.000Z');
    transaction.convention.create.mockResolvedValue({
      id: 'convention-1',
      title: 'Convenção coletiva',
      summary: 'Resumo oficial',
      effectiveFrom: null,
      effectiveUntil: null,
      publishedAt: null,
      createdByUserId: 'admin-1',
      createdAt: now,
      updatedAt: now,
      attachments: [],
      salaryScales: [
        {
          id: 'salary-scale-1',
          conventionId: 'convention-1',
          jobTitle: 'Farmacêutico',
          floorAmount: '3850.50',
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    transaction.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    await expect(
      service.createConvention('admin-1', {
        title: 'Convenção coletiva',
        summary: 'Resumo oficial',
        salaryScales: [{ jobTitle: ' Farmacêutico ', floorAmount: 3850.5 }],
      }),
    ).resolves.toMatchObject({
      salaryScales: [{ jobTitle: 'Farmacêutico', floorAmount: 3850.5 }],
    });

    expect(transaction.convention.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          salaryScales: {
            create: [{ jobTitle: 'Farmacêutico', floorAmount: 3850.5 }],
          },
        }),
      }),
    );
  });

  it('rejects duplicate job titles in convention salary scales', async () => {
    await expect(
      service.createConvention('admin-1', {
        title: 'Convenção coletiva',
        summary: 'Resumo oficial',
        salaryScales: [
          { jobTitle: 'Farmacêutico', floorAmount: 3850 },
          { jobTitle: ' FARMACÊUTICO ', floorAmount: 3900 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lists registrations immediately after they are submitted', async () => {
    const registration = {
      id: 'registration-pending',
      email: 'new-member@example.com',
      registrationStatus: RegistrationStatus.PENDING_APPROVAL,
      registrationRequestedAt: new Date('2026-10-12T00:00:00.000Z'),
      registrationApprovedAt: null,
      welcomeEmailSentAt: null,
      associate: {
        id: 'associate-pending',
        legalName: 'Farmácia Exemplo Ltda.',
        tradeName: null,
        cnpj: '11222333000181',
      },
    };
    prisma.user.findMany.mockResolvedValue([registration]);

    await expect(service.getRegistrations()).resolves.toEqual([registration]);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: UserRole.ASSOCIATE,
          registrationRequestedAt: { not: null },
          OR: expect.arrayContaining([
            { registrationStatus: RegistrationStatus.PENDING_APPROVAL },
          ]),
        }),
      }),
    );
  });

  it('approves a pending registration and sends its welcome email', async () => {
    const pendingUser = {
      id: 'registration-1',
      email: 'new-member@example.com',
      role: UserRole.ASSOCIATE,
      isActive: false,
      registrationStatus: RegistrationStatus.PENDING_APPROVAL,
      registrationRequestedAt: new Date('2026-10-12T00:00:00.000Z'),
      associate: {
        id: 'associate-1',
        legalName: 'Farmácia Exemplo Ltda.',
        cnpj: '11222333000181',
      },
    };
    transaction.user.findUnique.mockResolvedValue(pendingUser);
    transaction.user.updateMany.mockResolvedValue({ count: 1 });
    transaction.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    transaction.user.update.mockResolvedValue({ id: pendingUser.id });
    mailer.sendWelcome.mockResolvedValue(undefined);

    await expect(
      service.approveRegistration('admin-1', pendingUser.id),
    ).resolves.toMatchObject({
      status: RegistrationStatus.APPROVED,
      welcomeEmailSent: true,
    });

    expect(transaction.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: pendingUser.id,
          registrationStatus: RegistrationStatus.PENDING_APPROVAL,
          isActive: false,
        },
        data: expect.objectContaining({
          registrationStatus: RegistrationStatus.APPROVED,
          isActive: true,
          registrationApprovedByUserId: 'admin-1',
        }),
      }),
    );
    expect(mailer.sendWelcome).toHaveBeenCalledWith(
      pendingUser.email,
      pendingUser.associate.legalName,
    );
    expect(transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: pendingUser.id },
        data: { welcomeEmailSentAt: expect.any(Date) },
      }),
    );
  });

  it('keeps an approved registration queued when welcome delivery fails', async () => {
    const pendingUser = {
      id: 'registration-2',
      email: 'new-member@example.com',
      role: UserRole.ASSOCIATE,
      isActive: false,
      registrationStatus: RegistrationStatus.PENDING_APPROVAL,
      registrationRequestedAt: new Date('2026-10-12T00:00:00.000Z'),
      associate: {
        id: 'associate-2',
        legalName: 'Farmácia Exemplo Ltda.',
        cnpj: '11222333000181',
      },
    };
    transaction.user.findUnique.mockResolvedValue(pendingUser);
    transaction.user.updateMany.mockResolvedValue({ count: 1 });
    transaction.auditLog.create.mockResolvedValue({ id: 'audit-2' });
    mailer.sendWelcome.mockRejectedValue(new WelcomeEmailDeliveryError());
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-failed-email' });

    await expect(
      service.approveRegistration('admin-1', pendingUser.id),
    ).resolves.toMatchObject({
      status: RegistrationStatus.APPROVED,
      welcomeEmailSent: false,
      message: expect.stringContaining('e-mail não foi enviado'),
    });

    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'REGISTRATION_WELCOME_EMAIL_FAILED',
        entityId: pendingUser.id,
      }),
    });
  });
});
