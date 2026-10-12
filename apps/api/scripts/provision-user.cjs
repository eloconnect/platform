const bcrypt = require('bcryptjs');
const { isEmail } = require('class-validator');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/prisma/client.js');

function required(name) {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`Required environment variable ${name} is missing.`);
  }
  return value;
}

async function main() {
  const email = required('PROVISION_EMAIL').trim().toLowerCase();
  const password = required('PROVISION_PASSWORD');
  const role = (process.env.PROVISION_ROLE ?? 'ADMIN').trim().toUpperCase();

  if (!isEmail(email)) {
    throw new Error('PROVISION_EMAIL must be a valid e-mail address.');
  }
  if (!['ADMIN', 'ASSOCIATE'].includes(role)) {
    throw new Error('PROVISION_ROLE must be ADMIN or ASSOCIATE.');
  }
  if (
    Array.from(password).length < 8 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    throw new Error(
      'PROVISION_PASSWORD must have at least 8 characters and at most 72 UTF-8 bytes.',
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: required('DATABASE_URL') }),
  });

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error(
        'A user with this e-mail already exists; no changes were made.',
      );
    }

    await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        role,
      },
    });
    console.info(`Provisioned ${role} account for ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'User provisioning failed.',
  );
  process.exitCode = 1;
});
