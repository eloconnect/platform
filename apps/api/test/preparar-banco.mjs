// Os testes e2e rodam num banco separado (<banco>_test), no mesmo Postgres.
// O log de auditoria não pode ser apagado, então os registros criados pelos
// testes ficariam no banco de desenvolvimento. Este arquivo recria o banco de
// teste a cada rodada, aplica as migrations e aponta o DATABASE_URL para ele
// antes dos testes. Recriar evita que os dados das rodadas anteriores, que os
// testes não conseguem apagar, deixem o lote e o bloqueio lentos, e deixa a
// rodada local igual à do CI, que começa com o banco vazio.
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
    // Só o banco de teste: o nome sempre termina em "_test".
    await cliente.query(`DROP DATABASE IF EXISTS "${bancoTeste}" WITH (FORCE)`);
    await cliente.query(`CREATE DATABASE "${bancoTeste}"`);
  } finally {
    await cliente.end();
  }

  url.pathname = `/${bancoTeste}`;
  process.env.DATABASE_URL = url.toString();
  execSync('pnpm exec prisma migrate deploy', { stdio: 'pipe' });
}
