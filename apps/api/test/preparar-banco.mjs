// Os testes e2e rodam num banco separado (<banco>_test), no mesmo Postgres.
// O log de auditoria não pode ser apagado, então os registros criados pelos
// testes ficariam no banco de desenvolvimento. Este arquivo cria o banco de
// teste se ele não existir, aplica as migrations e aponta o DATABASE_URL para
// ele antes dos testes.
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { Client } from 'pg';

export default async function prepararBanco() {
  const url = new URL(process.env.DATABASE_URL);
  const banco = url.pathname.slice(1);
  if (banco.endsWith('_test')) return;
  const bancoTeste = `${banco}_test`;

  const cliente = new Client({ connectionString: url.toString() });
  await cliente.connect();
  try {
    const { rowCount } = await cliente.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [bancoTeste],
    );
    if (rowCount === 0) {
      await cliente.query(`CREATE DATABASE "${bancoTeste}"`);
    }
  } finally {
    await cliente.end();
  }

  url.pathname = `/${bancoTeste}`;
  process.env.DATABASE_URL = url.toString();
  execSync('pnpm exec prisma migrate deploy', { stdio: 'pipe' });
}
