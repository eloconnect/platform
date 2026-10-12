const bcrypt = require('bcryptjs');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/prisma/client.js');

const demoPassword = 'elloconnect123';
const demoAccounts = [
  {
    id: 'demo-admin',
    email: 'admin@example.com',
    role: 'ADMIN',
  },
  {
    id: 'demo-associate-current',
    email: 'adimplente@example.com',
    role: 'ASSOCIATE',
    associate: {
      id: 'demo-associate-current',
      cnpj: buildCnpj('123456780001'),
      legalName: 'Farmacia Ficticia Adimplente Ltda.',
      tradeName: 'Farmacia Exemplo Azul',
      status: 'ADIMPLENTE',
      recurringBilling: true,
    },
  },
  {
    id: 'demo-associate-overdue',
    email: 'inadimplente@example.com',
    role: 'ASSOCIATE',
    associate: {
      id: 'demo-associate-overdue',
      cnpj: buildCnpj('123456780002'),
      legalName: 'Farmacia Ficticia Inadimplente Ltda.',
      tradeName: 'Farmacia Exemplo Verde',
      status: 'INADIMPLENTE',
      recurringBilling: true,
    },
  },
];

const demoBenefits = [
  {
    id: 'demo-benefit-legal-advisory',
    title: 'Assessoria Jurídica Trabalhista',
    description:
      'Orientação sobre contratos de trabalho, jornada e relações com empregados.',
  },
  {
    id: 'demo-benefit-pharmacy-discounts',
    title: 'Clube de Compras e Medicamentos',
    description:
      'Consulte condições e descontos comerciais oferecidos por parceiros.',
  },
  {
    id: 'demo-benefit-membership-certificate',
    title: 'Certidão Negativa Sindical (CND)',
    description:
      'Solicite orientação para emissão da certidão de regularidade sindical.',
  },
];

function buildCnpj(base) {
  const firstDigit = calculateCheckDigit(
    base,
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  const secondDigit = calculateCheckDigit(
    `${base}${firstDigit}`,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return `${base}${firstDigit}${secondDigit}`;
}

function calculateCheckDigit(value, weights) {
  const sum = [...value].reduce(
    (total, digit, index) => total + Number(digit) * weights[index],
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function required(name) {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`Required environment variable ${name} is missing.`);
  }
  return value;
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed is disabled in production.');
  }
  if (process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error(
      'Set ALLOW_DEMO_SEED=true to explicitly allow fictional demo data.',
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: required('DATABASE_URL') }),
  });
  const passwordHash = await bcrypt.hash(demoPassword, 12);

  try {
    await prisma.$transaction(async (transaction) => {
      for (const account of demoAccounts) {
        let user = await transaction.user.findUnique({
          where: { email: account.email },
        });

        if (user) {
          const matchesSeed =
            user.id === account.id &&
            user.role === account.role &&
            user.isActive &&
            (await bcrypt.compare(demoPassword, user.passwordHash));
          if (!matchesSeed) {
            throw new Error(
              `Refusing to modify the existing account ${account.email}.`,
            );
          }
        } else {
          user = await transaction.user.create({
            data: {
              id: account.id,
              email: account.email,
              passwordHash,
              role: account.role,
            },
          });
        }

        if (!account.associate) {
          continue;
        }

        const existingAssociate = await transaction.associate.findUnique({
          where: { userId: user.id },
        });
        if (existingAssociate) {
          if (existingAssociate.cnpj !== account.associate.cnpj) {
            throw new Error(
              `Refusing to modify the existing associate for ${account.email}.`,
            );
          }
          continue;
        }

        await transaction.associate.create({
          data: {
            ...account.associate,
            userId: user.id,
          },
        });
      }

      const admin = await transaction.user.findUniqueOrThrow({
        where: { email: 'admin@example.com' },
      });
      const activeAssociate = await transaction.associate.findUniqueOrThrow({
        where: { userId: 'demo-associate-current' },
      });

      let contribution = await transaction.contributionValue.findFirst({
        where: { effectiveFrom: { lte: new Date() } },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (!contribution) {
        contribution = await transaction.contributionValue.create({
          data: {
            id: 'demo-contribution-initial',
            monthlyAmount: 185,
            annualAmount: 1776,
            effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
            createdByUserId: admin.id,
          },
        });
      }

      for (const benefit of demoBenefits) {
        const existing = await transaction.benefit.findUnique({
          where: { id: benefit.id },
        });
        if (existing) {
          if (
            existing.title !== benefit.title ||
            existing.description !== benefit.description ||
            existing.createdByUserId !== admin.id
          ) {
            throw new Error(
              `Refusing to modify the existing demo benefit ${benefit.id}.`,
            );
          }
          continue;
        }
        await transaction.benefit.create({
          data: { ...benefit, createdByUserId: admin.id },
        });
      }

      const existingBills = await transaction.bill.count({
        where: { associateId: activeAssociate.id },
      });
      if (existingBills === 0) {
        const nextMonth = new Date();
        nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 1);
        const dueDate = new Date(
          Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), 15),
        );
        const monthId = `${dueDate.getUTCFullYear()}${String(
          dueDate.getUTCMonth() + 1,
        ).padStart(2, '0')}`;
        await transaction.bill.create({
          data: {
            id: `demo-bill-${monthId}`,
            associateId: activeAssociate.id,
            identifier: `DEMO-${monthId}`,
            amount: contribution.monthlyAmount,
            dueDate,
            status: 'EM_ABERTO',
          },
        });
      }
    });

    console.info('Fictional demo seed completed without overwriting records.');
    console.info(
      'The DEMO bill has no payment payload or PDF and cannot be paid.',
    );
    console.info('Demo login: admin@example.com / elloconnect123');
    console.info('Demo login: adimplente@example.com / elloconnect123');
    console.info('Demo login: inadimplente@example.com / elloconnect123');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Demo seed failed.');
  process.exitCode = 1;
});
