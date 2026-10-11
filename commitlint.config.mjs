// Conventional Commits com descrição em português.
// subject-case desligado: nomes próprios (PostgreSQL, Prisma, NestJS) começam com maiúscula.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [0],
  },
};
