import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  AssociateStatus,
  BillStatus,
  ContributionProposalStatus,
  RegistrationStatus,
  UserRole,
} from '../generated/prisma/enums';
import {
  MailerService,
  WelcomeEmailDeliveryError,
} from '../auth/mailer.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOverviewQueryDto } from './dto/admin-overview-query.dto';
import { CreateContributionProposalDto } from './dto/create-contribution-proposal.dto';
import { DecideContributionProposalDto } from './dto/decide-contribution-proposal.dto';
import { SaveBenefitDto } from './dto/save-benefit.dto';
import { SaveConventionDto } from './dto/save-convention.dto';

const annualDiscountPercent = 20;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  async getOverview(query: AdminOverviewQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.AssociateWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { legalName: { contains: search, mode: 'insensitive' } },
              { tradeName: { contains: search, mode: 'insensitive' } },
              { cnpj: { contains: search } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [
      totalAssociates,
      upToDateAssociates,
      overdueAssociates,
      disabledAssociates,
      draftBills,
      pendingCancellations,
      filteredCount,
      associates,
    ] = await Promise.all([
      this.prisma.associate.count(),
      this.prisma.associate.count({
        where: { status: AssociateStatus.ADIMPLENTE },
      }),
      this.prisma.associate.count({
        where: { status: AssociateStatus.INADIMPLENTE },
      }),
      this.prisma.associate.count({
        where: { status: AssociateStatus.CANCELADO },
      }),
      this.prisma.bill.count({ where: { status: BillStatus.RASCUNHO } }),
      this.prisma.cancellationRequest.count({ where: { status: 'PENDENTE' } }),
      this.prisma.associate.count({ where }),
      this.prisma.associate.findMany({
        where,
        orderBy: { legalName: 'asc' },
        skip,
        take: query.pageSize,
        select: {
          id: true,
          cnpj: true,
          legalName: true,
          tradeName: true,
          status: true,
          recurringBilling: true,
          manuallyBlocked: true,
          bills: {
            orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
            take: 1,
            select: {
              identifier: true,
              amount: true,
              dueDate: true,
              status: true,
            },
          },
        },
      }),
    ]);

    return {
      metrics: {
        totalAssociates,
        upToDateAssociates,
        overdueAssociates,
        disabledAssociates,
        draftBills,
        pendingCancellations,
      },
      page: query.page,
      pageSize: query.pageSize,
      total: filteredCount,
      associates: associates.map(({ bills, ...associate }) => ({
        ...associate,
        lastBill: bills[0]
          ? {
              ...bills[0],
              amount: Number(bills[0].amount),
            }
          : null,
      })),
    };
  }

  async getRegistrations() {
    const registrations = await this.prisma.user.findMany({
      where: {
        role: UserRole.ASSOCIATE,
        registrationRequestedAt: { not: null },
        OR: [
          { registrationStatus: RegistrationStatus.PENDING_APPROVAL },
          {
            registrationStatus: RegistrationStatus.APPROVED,
            welcomeEmailSentAt: null,
          },
        ],
      },
      orderBy: { registrationRequestedAt: 'asc' },
      select: {
        id: true,
        email: true,
        registrationStatus: true,
        registrationRequestedAt: true,
        registrationApprovedAt: true,
        welcomeEmailSentAt: true,
        associate: {
          select: { id: true, legalName: true, tradeName: true, cnpj: true },
        },
      },
    });

    return registrations
      .filter((registration) => registration.associate !== null)
      .map((registration) => ({
        ...registration,
        associate: registration.associate!,
      }));
  }

  async approveRegistration(adminUserId: string, id: string) {
    const registration = await this.prisma.$transaction(async (transaction) => {
      const pending = await transaction.user.findUnique({
        where: { id },
        include: { associate: true },
      });
      if (
        !pending ||
        pending.role !== UserRole.ASSOCIATE ||
        pending.registrationRequestedAt === null ||
        !pending.associate
      ) {
        throw new NotFoundException('Solicitação de cadastro não encontrada.');
      }
      if (pending.registrationStatus !== RegistrationStatus.PENDING_APPROVAL) {
        throw new ConflictException(
          'Esta solicitação já foi aprovada ou não está pendente.',
        );
      }

      const approvedAt = new Date();
      const updated = await transaction.user.updateMany({
        where: {
          id,
          registrationStatus: RegistrationStatus.PENDING_APPROVAL,
          isActive: false,
        },
        data: {
          registrationStatus: RegistrationStatus.APPROVED,
          registrationApprovedAt: approvedAt,
          registrationApprovedByUserId: adminUserId,
          isActive: true,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'Esta solicitação já foi aprovada por outro administrador.',
        );
      }

      await this.writeAudit(transaction, adminUserId, {
        action: 'REGISTRATION_APPROVED',
        entity: 'User',
        entityId: pending.id,
        previousValues: {
          registrationStatus: RegistrationStatus.PENDING_APPROVAL,
          isActive: false,
        },
        newValues: {
          registrationStatus: RegistrationStatus.APPROVED,
          isActive: true,
          registrationApprovedAt: approvedAt.toISOString(),
          email: pending.email,
          cnpj: pending.associate.cnpj,
        },
      });

      return {
        id: pending.id,
        email: pending.email,
        legalName: pending.associate.legalName,
        associateId: pending.associate.id,
      };
    });

    const welcomeEmailSent = await this.deliverRegistrationWelcome(
      adminUserId,
      registration,
    );
    return {
      id: registration.id,
      status: RegistrationStatus.APPROVED,
      welcomeEmailSent,
      message: welcomeEmailSent
        ? 'Cadastro aprovado e e-mail de boas-vindas enviado.'
        : 'Cadastro aprovado, mas o e-mail não foi enviado. Corrija o SMTP e use a opção de reenvio.',
    };
  }

  async resendRegistrationWelcomeEmail(adminUserId: string, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { associate: true },
    });
    if (
      !user ||
      user.role !== UserRole.ASSOCIATE ||
      user.registrationRequestedAt === null ||
      !user.associate
    ) {
      throw new NotFoundException('Solicitação de cadastro não encontrada.');
    }
    if (
      user.registrationStatus !== RegistrationStatus.APPROVED ||
      !user.isActive
    ) {
      throw new ConflictException(
        'Aprove o cadastro antes de enviar o e-mail de boas-vindas.',
      );
    }

    const welcomeEmailSent = await this.deliverRegistrationWelcome(
      adminUserId,
      {
        id: user.id,
        email: user.email,
        legalName: user.associate.legalName,
        associateId: user.associate.id,
      },
    );
    return {
      id: user.id,
      status: RegistrationStatus.APPROVED,
      welcomeEmailSent,
      message: welcomeEmailSent
        ? 'E-mail de boas-vindas enviado.'
        : 'O e-mail não foi enviado. Verifique a configuração SMTP e tente novamente.',
    };
  }

  private async deliverRegistrationWelcome(
    adminUserId: string,
    registration: {
      id: string;
      email: string;
      legalName: string;
      associateId: string;
    },
  ) {
    try {
      await this.mailer.sendWelcome(registration.email, registration.legalName);
    } catch (error) {
      if (!(error instanceof WelcomeEmailDeliveryError)) {
        throw error;
      }
      await this.writeAudit(this.prisma, adminUserId, {
        action: 'REGISTRATION_WELCOME_EMAIL_FAILED',
        entity: 'User',
        entityId: registration.id,
        previousValues: {},
        newValues: { delivery: 'FAILED' },
      });
      return false;
    }

    await this.prisma.$transaction(async (transaction) => {
      const sentAt = new Date();
      await transaction.user.update({
        where: { id: registration.id },
        data: { welcomeEmailSentAt: sentAt },
      });
      await this.writeAudit(transaction, adminUserId, {
        action: 'REGISTRATION_WELCOME_EMAIL_SENT',
        entity: 'User',
        entityId: registration.id,
        previousValues: {},
        newValues: {
          delivery: 'SENT',
          recipient: registration.email,
          sentAt: sentAt.toISOString(),
        },
      });
    });
    return true;
  }

  async getContributions() {
    const [current, history, proposals] = await Promise.all([
      this.prisma.contributionValue.findFirst({
        where: { effectiveFrom: { lte: new Date() } },
        orderBy: { effectiveFrom: 'desc' },
      }),
      this.prisma.contributionValue.findMany({
        orderBy: { effectiveFrom: 'desc' },
        take: 20,
      }),
      this.prisma.contributionProposal.findMany({
        orderBy: { submittedAt: 'desc' },
        take: 20,
        include: {
          createdBy: { select: { email: true } },
          reviewedBy: { select: { email: true } },
        },
      }),
    ]);

    return {
      current: current
        ? {
            id: current.id,
            monthlyAmount: Number(current.monthlyAmount),
            annualAmount: Number(current.annualAmount),
            effectiveFrom: current.effectiveFrom,
          }
        : null,
      history: history.map((value) => ({
        id: value.id,
        monthlyAmount: Number(value.monthlyAmount),
        annualAmount: Number(value.annualAmount),
        effectiveFrom: value.effectiveFrom,
        createdAt: value.createdAt,
      })),
      proposals: proposals.map((proposal) => ({
        id: proposal.id,
        monthlyAmount: Number(proposal.monthlyAmount),
        annualAmount: Number(proposal.annualAmount),
        annualDiscountPercent: proposal.annualDiscountPercent,
        effectiveFrom: proposal.effectiveFrom,
        status: proposal.status,
        note: proposal.note,
        decisionNote: proposal.decisionNote,
        submittedAt: proposal.submittedAt,
        submittedBy: proposal.createdBy.email,
        reviewedAt: proposal.reviewedAt,
        reviewedBy: proposal.reviewedBy?.email ?? null,
      })),
    };
  }

  async createContributionProposal(
    userId: string,
    dto: CreateContributionProposalDto,
  ) {
    const normalizedAnnual = Math.round(dto.annualAmount * 100) / 100;
    const monthlyAmount =
      Math.round(
        (normalizedAnnual / (12 * (1 - annualDiscountPercent / 100))) * 100,
      ) / 100;
    const effectiveFrom = new Date(
      Date.UTC(new Date().getUTCFullYear() + 1, 0, 1),
    );

    return this.prisma.$transaction(async (transaction) => {
      const proposal = await transaction.contributionProposal.create({
        data: {
          annualAmount: normalizedAnnual,
          monthlyAmount,
          annualDiscountPercent,
          effectiveFrom,
          note: dto.note?.trim() || null,
          submittedByUserId: userId,
        },
      });
      await this.writeAudit(transaction, userId, {
        action: 'CONTRIBUTION_PROPOSAL_SUBMITTED',
        entity: 'ContributionProposal',
        entityId: proposal.id,
        previousValues: {},
        newValues: {
          annualAmount: normalizedAnnual,
          monthlyAmount,
          annualDiscountPercent,
          effectiveFrom: effectiveFrom.toISOString(),
          status: ContributionProposalStatus.PENDING_HOMOLOGATION,
          note: proposal.note,
        },
      });
      return {
        id: proposal.id,
        annualAmount: Number(proposal.annualAmount),
        monthlyAmount: Number(proposal.monthlyAmount),
        annualDiscountPercent: proposal.annualDiscountPercent,
        effectiveFrom: proposal.effectiveFrom,
        status: proposal.status,
        submittedAt: proposal.submittedAt,
      };
    });
  }

  async decideContributionProposal(
    userId: string,
    id: string,
    dto: DecideContributionProposalDto,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const proposal = await transaction.contributionProposal.findUnique({
        where: { id },
      });
      if (!proposal) {
        throw new NotFoundException('Proposta de reajuste não encontrada.');
      }
      if (proposal.status !== ContributionProposalStatus.PENDING_HOMOLOGATION) {
        throw new ConflictException(
          'Esta proposta já teve uma decisão registrada.',
        );
      }

      const decision =
        dto.decision === 'APPROVED'
          ? ContributionProposalStatus.APPROVED
          : ContributionProposalStatus.REJECTED;
      const updated = await transaction.contributionProposal.updateMany({
        where: {
          id,
          status: ContributionProposalStatus.PENDING_HOMOLOGATION,
        },
        data: {
          status: decision,
          reviewedAt: new Date(),
          reviewedByUserId: userId,
          decisionNote: dto.note?.trim() || null,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'Esta proposta já teve uma decisão registrada.',
        );
      }

      if (decision === ContributionProposalStatus.APPROVED) {
        await transaction.contributionValue.create({
          data: {
            monthlyAmount: proposal.monthlyAmount,
            annualAmount: proposal.annualAmount,
            effectiveFrom: proposal.effectiveFrom,
            createdByUserId: userId,
          },
        });
      }

      await this.writeAudit(transaction, userId, {
        action: `CONTRIBUTION_PROPOSAL_${decision}`,
        entity: 'ContributionProposal',
        entityId: proposal.id,
        previousValues: {
          status: ContributionProposalStatus.PENDING_HOMOLOGATION,
        },
        newValues: {
          status: decision,
          decisionNote: dto.note?.trim() || null,
          effectiveFrom: proposal.effectiveFrom.toISOString(),
          monthlyAmount: Number(proposal.monthlyAmount),
          annualAmount: Number(proposal.annualAmount),
        },
      });
      return { id, status: decision };
    });
  }

  async getConventions() {
    const conventions = await this.prisma.convention.findMany({
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        attachments: {
          select: { id: true, fileName: true, url: true },
          orderBy: { createdAt: 'desc' },
        },
        salaryScales: { orderBy: { jobTitle: 'asc' } },
      },
    });
    return conventions.map((convention) =>
      this.serializeConvention(convention),
    );
  }

  async createConvention(userId: string, dto: SaveConventionDto) {
    this.validateConvention(dto);
    return this.prisma.$transaction(async (transaction) => {
      const convention = await transaction.convention.create({
        data: {
          title: dto.title.trim(),
          summary: dto.summary.trim(),
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
          effectiveUntil: dto.effectiveUntil
            ? new Date(dto.effectiveUntil)
            : null,
          publishedAt: dto.published ? new Date() : null,
          createdByUserId: userId,
          ...(dto.attachmentUrl && dto.attachmentFileName
            ? {
                attachments: {
                  create: {
                    fileName: dto.attachmentFileName.trim(),
                    url: dto.attachmentUrl,
                    uploadedByUserId: userId,
                  },
                },
              }
            : {}),
          ...(dto.salaryScales
            ? {
                salaryScales: {
                  create: dto.salaryScales.map((salaryScale) => ({
                    jobTitle: salaryScale.jobTitle.trim(),
                    floorAmount: salaryScale.floorAmount,
                  })),
                },
              }
            : {}),
        },
        include: { attachments: true, salaryScales: true },
      });
      await this.writeAudit(transaction, userId, {
        action: dto.published ? 'CONVENTION_PUBLISHED' : 'CONVENTION_CREATED',
        entity: 'Convention',
        entityId: convention.id,
        previousValues: {},
        newValues: {
          title: convention.title,
          effectiveFrom: convention.effectiveFrom?.toISOString() ?? null,
          effectiveUntil: convention.effectiveUntil?.toISOString() ?? null,
          publishedAt: convention.publishedAt?.toISOString() ?? null,
          salaryScales: convention.salaryScales.map((salaryScale) => ({
            jobTitle: salaryScale.jobTitle,
            floorAmount: Number(salaryScale.floorAmount),
          })),
        },
      });
      return this.serializeConvention(convention);
    });
  }

  async updateConvention(userId: string, id: string, dto: SaveConventionDto) {
    this.validateConvention(dto);
    return this.prisma.$transaction(async (transaction) => {
      const previous = await transaction.convention.findUnique({
        where: { id },
        include: { salaryScales: true },
      });
      if (!previous) {
        throw new NotFoundException('Convenção coletiva não encontrada.');
      }
      const data = {
        title: dto.title.trim(),
        summary: dto.summary.trim(),
        ...(dto.effectiveFrom !== undefined
          ? {
              effectiveFrom: dto.effectiveFrom
                ? new Date(dto.effectiveFrom)
                : null,
            }
          : {}),
        ...(dto.effectiveUntil !== undefined
          ? {
              effectiveUntil: dto.effectiveUntil
                ? new Date(dto.effectiveUntil)
                : null,
            }
          : {}),
        ...(dto.published !== undefined
          ? { publishedAt: dto.published ? new Date() : null }
          : {}),
        ...(dto.salaryScales !== undefined
          ? {
              salaryScales: {
                deleteMany: {},
                ...(dto.salaryScales.length
                  ? {
                      create: dto.salaryScales.map((salaryScale) => ({
                        jobTitle: salaryScale.jobTitle.trim(),
                        floorAmount: salaryScale.floorAmount,
                      })),
                    }
                  : {}),
              },
            }
          : {}),
      };
      const convention = await transaction.convention.update({
        where: { id },
        data: {
          ...data,
          ...(dto.attachmentUrl && dto.attachmentFileName
            ? {
                attachments: {
                  create: {
                    fileName: dto.attachmentFileName.trim(),
                    url: dto.attachmentUrl,
                    uploadedByUserId: userId,
                  },
                },
              }
            : {}),
        },
        include: { attachments: true, salaryScales: true },
      });
      await this.writeAudit(transaction, userId, {
        action: 'CONVENTION_UPDATED',
        entity: 'Convention',
        entityId: id,
        previousValues: {
          title: previous.title,
          summary: previous.summary,
          effectiveFrom: previous.effectiveFrom?.toISOString() ?? null,
          effectiveUntil: previous.effectiveUntil?.toISOString() ?? null,
          publishedAt: previous.publishedAt?.toISOString() ?? null,
          salaryScales: previous.salaryScales.map((salaryScale) => ({
            jobTitle: salaryScale.jobTitle,
            floorAmount: Number(salaryScale.floorAmount),
          })),
        },
        newValues: {
          title: convention.title,
          summary: convention.summary,
          effectiveFrom: convention.effectiveFrom?.toISOString() ?? null,
          effectiveUntil: convention.effectiveUntil?.toISOString() ?? null,
          publishedAt: convention.publishedAt?.toISOString() ?? null,
          salaryScales: convention.salaryScales.map((salaryScale) => ({
            jobTitle: salaryScale.jobTitle,
            floorAmount: Number(salaryScale.floorAmount),
          })),
        },
      });
      return this.serializeConvention(convention);
    });
  }

  getBenefits() {
    return this.prisma.benefit.findMany({
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async createBenefit(userId: string, dto: SaveBenefitDto) {
    const title = dto.title?.trim();
    const description = dto.description?.trim();
    if (!title || !description) {
      throw new BadRequestException(
        'Informe o título e a descrição do benefício.',
      );
    }
    return this.prisma.$transaction(async (transaction) => {
      const benefit = await transaction.benefit.create({
        data: {
          title,
          description,
          isActive: dto.isActive ?? true,
          createdByUserId: userId,
        },
      });
      await this.writeAudit(transaction, userId, {
        action: 'BENEFIT_CREATED',
        entity: 'Benefit',
        entityId: benefit.id,
        previousValues: {},
        newValues: {
          title: benefit.title,
          description: benefit.description,
          isActive: benefit.isActive,
        },
      });
      return benefit;
    });
  }

  async updateBenefit(userId: string, id: string, dto: SaveBenefitDto) {
    if (
      (dto.title !== undefined && !dto.title.trim()) ||
      (dto.description !== undefined && !dto.description.trim())
    ) {
      throw new BadRequestException(
        'O título e a descrição do benefício não podem ficar vazios.',
      );
    }
    return this.prisma.$transaction(async (transaction) => {
      const previous = await transaction.benefit.findUnique({ where: { id } });
      if (!previous) {
        throw new NotFoundException('Benefício não encontrado.');
      }
      const benefit = await transaction.benefit.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      await this.writeAudit(transaction, userId, {
        action: 'BENEFIT_UPDATED',
        entity: 'Benefit',
        entityId: id,
        previousValues: {
          title: previous.title,
          description: previous.description,
          isActive: previous.isActive,
        },
        newValues: {
          title: benefit.title,
          description: benefit.description,
          isActive: benefit.isActive,
        },
      });
      return benefit;
    });
  }

  private validateConvention(dto: SaveConventionDto) {
    if (!dto.title.trim() || !dto.summary.trim()) {
      throw new BadRequestException(
        'O título e o resumo da convenção não podem ficar vazios.',
      );
    }
    if (Boolean(dto.attachmentUrl) !== Boolean(dto.attachmentFileName)) {
      throw new BadRequestException(
        'Informe o nome e o link do documento para anexá-lo.',
      );
    }
    if (
      dto.attachmentFileName !== undefined &&
      !dto.attachmentFileName.trim()
    ) {
      throw new BadRequestException('Informe um nome de arquivo válido.');
    }
    if (
      dto.effectiveFrom &&
      dto.effectiveUntil &&
      new Date(dto.effectiveUntil) < new Date(dto.effectiveFrom)
    ) {
      throw new BadRequestException(
        'O fim da vigência não pode ser anterior ao início.',
      );
    }
    const jobTitles =
      dto.salaryScales?.map((salaryScale) =>
        salaryScale.jobTitle.trim().toLocaleLowerCase('pt-BR'),
      ) ?? [];
    if (new Set(jobTitles).size !== jobTitles.length) {
      throw new BadRequestException(
        'Cada cargo pode aparecer apenas uma vez na tabela de pisos.',
      );
    }
  }

  private serializeConvention<
    T extends { salaryScales: Array<{ floorAmount: Prisma.Decimal }> },
  >(convention: T) {
    return {
      ...convention,
      salaryScales: convention.salaryScales.map((salaryScale) => ({
        ...salaryScale,
        floorAmount: Number(salaryScale.floorAmount),
      })),
    };
  }

  private writeAudit(
    transaction: Prisma.TransactionClient,
    actorUserId: string,
    entry: {
      action: string;
      entity: string;
      entityId: string;
      previousValues: Prisma.InputJsonObject;
      newValues: Prisma.InputJsonObject;
    },
  ) {
    return transaction.auditLog.create({
      data: { actorUserId, ...entry },
    });
  }
}
