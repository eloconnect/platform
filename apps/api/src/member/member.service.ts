import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssociateStatus,
  BillStatus,
  CancellationStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

const activeBillStatuses = [BillStatus.EM_ABERTO, BillStatus.VENCIDO];

@Injectable()
export class MemberService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: string) {
    const associate = await this.getAssociate(userId);
    const [contribution, bills, news, latestCancellation] = await Promise.all([
      this.prisma.contributionValue.findFirst({
        where: { effectiveFrom: { lte: new Date() } },
        orderBy: { effectiveFrom: 'desc' },
      }),
      this.prisma.bill.findMany({
        where: {
          associateId: associate.id,
          status: { in: activeBillStatuses },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
      this.getNews(),
      this.prisma.cancellationRequest.findFirst({
        where: { associateId: associate.id },
        orderBy: { requestedAt: 'desc' },
      }),
    ]);

    return {
      associate: {
        id: associate.id,
        legalName: associate.legalName,
        tradeName: associate.tradeName,
        status: associate.status,
        recurringBilling: associate.recurringBilling,
      },
      access: {
        benefits:
          associate.status === AssociateStatus.ADIMPLENTE &&
          !associate.manuallyBlocked,
        conventions: associate.status !== AssociateStatus.CANCELADO,
        conventionDocuments:
          associate.status === AssociateStatus.ADIMPLENTE &&
          !associate.manuallyBlocked,
        support:
          associate.status === AssociateStatus.ADIMPLENTE &&
          !associate.manuallyBlocked,
      },
      contribution: contribution
        ? {
            monthlyAmount: Number(contribution.monthlyAmount),
            annualAmount: Number(contribution.annualAmount),
            effectiveFrom: contribution.effectiveFrom,
          }
        : null,
      openBills: bills.map((bill) => ({
        id: bill.id,
        identifier: bill.identifier,
        amount: Number(bill.amount),
        dueDate: bill.dueDate,
        status: bill.status,
        hasPix: Boolean(bill.pixPayload),
        hasPdf: Boolean(bill.pdfUrl),
      })),
      news,
      cancellation: latestCancellation
        ? {
            status: latestCancellation.status,
            requestedAt: latestCancellation.requestedAt,
          }
        : null,
    };
  }

  async getBills(userId: string) {
    const associate = await this.getAssociate(userId);
    const bills = await this.prisma.bill.findMany({
      where: { associateId: associate.id },
      orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        transactions: { orderBy: { occurredAt: 'desc' } },
      },
    });

    return bills.map((bill) => ({
      id: bill.id,
      identifier: bill.identifier,
      amount: Number(bill.amount),
      dueDate: bill.dueDate,
      status: bill.status,
      pixPayload: bill.pixPayload,
      pdfUrl: bill.pdfUrl,
      transactions: bill.transactions.map((transaction) => ({
        amount: Number(transaction.amount),
        status: transaction.status,
        paymentMethod: transaction.paymentMethod,
        occurredAt: transaction.occurredAt,
      })),
    }));
  }

  async getBenefits(userId: string) {
    await this.getBenefitEligibleAssociate(userId);
    return this.prisma.benefit.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, description: true },
    });
  }

  async getConventions(userId: string) {
    const associate = await this.getAssociate(userId);
    if (associate.status === AssociateStatus.CANCELADO) {
      throw new ForbiddenException(
        'Este recurso está disponível somente para associações ativas.',
      );
    }
    const conventions = await this.prisma.convention.findMany({
      where: { publishedAt: { not: null } },
      orderBy: [{ effectiveFrom: 'desc' }, { publishedAt: 'desc' }],
      select: {
        id: true,
        title: true,
        summary: true,
        effectiveFrom: true,
        effectiveUntil: true,
        publishedAt: true,
        attachments: {
          select: { id: true, fileName: true, url: true },
        },
        salaryScales: {
          select: { id: true, jobTitle: true, floorAmount: true },
          orderBy: { jobTitle: 'asc' },
        },
      },
    });
    const withNumericFloors = conventions.map((convention) => ({
      ...convention,
      salaryScales: convention.salaryScales.map((salaryScale) => ({
        ...salaryScale,
        floorAmount: Number(salaryScale.floorAmount),
      })),
    }));
    if (
      associate.status === AssociateStatus.ADIMPLENTE &&
      !associate.manuallyBlocked
    ) {
      return withNumericFloors;
    }
    return withNumericFloors.map(
      ({ attachments: _attachments, ...convention }) => ({
        ...convention,
        attachments: [],
      }),
    );
  }

  async getNews() {
    const news = await this.prisma.news.findMany({
      where: { publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        content: true,
        publishedAt: true,
      },
    });
    return news;
  }

  async getSupport(userId: string) {
    await this.getBenefitEligibleAssociate(userId);
    return {
      phone: '0800 724 3000',
      hours: 'Segunda a sexta-feira, das 8h às 18h.',
    };
  }

  async requestCancellation(userId: string, confirmed: boolean) {
    if (!confirmed) {
      throw new BadRequestException(
        'Confirme que compreendeu as consequências da desativação.',
      );
    }
    const associate = await this.getAssociate(userId);
    if (associate.status === AssociateStatus.CANCELADO) {
      throw new ConflictException('A associação já está desativada.');
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.associate.updateMany({
        where: {
          id: associate.id,
          status: { not: AssociateStatus.CANCELADO },
        },
        data: {
          status: AssociateStatus.CANCELADO,
          recurringBilling: false,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('A associação já está desativada.');
      }

      const cancellation = await transaction.cancellationRequest.create({
        data: {
          associateId: associate.id,
          status: CancellationStatus.EFETIVADO,
          decisionNote: 'Desativada pelo associado conforme solicitação.',
        },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: userId,
          associateId: associate.id,
          action: 'ASSOCIATION_CANCELLED_BY_MEMBER',
          entity: 'Associate',
          entityId: associate.id,
          previousValues: {
            status: associate.status,
            recurringBilling: associate.recurringBilling,
          },
          newValues: {
            status: AssociateStatus.CANCELADO,
            recurringBilling: false,
            cancellationRequestId: cancellation.id,
          },
        },
      });

      return {
        status: AssociateStatus.CANCELADO,
        message:
          'A associação foi desativada. Você ainda pode entrar na conta e consultar seus boletos, mas não terá acesso aos benefícios, convenções ou suporte.',
      };
    });
  }

  private async getAssociate(userId: string) {
    const associate = await this.prisma.associate.findUnique({
      where: { userId },
    });
    if (!associate) {
      throw new NotFoundException(
        'Não encontramos um estabelecimento associado a esta conta.',
      );
    }
    return associate;
  }

  private async getBenefitEligibleAssociate(userId: string) {
    const associate = await this.getAssociate(userId);
    if (
      associate.status !== AssociateStatus.ADIMPLENTE ||
      associate.manuallyBlocked
    ) {
      throw new ForbiddenException(
        'Este recurso está disponível somente para associados adimplentes sem bloqueio de acesso.',
      );
    }
    return associate;
  }
}
