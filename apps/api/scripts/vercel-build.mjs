// Build da API na Vercel (demonstração do PI). Compila o packages/shared, que a
// API importa, e só no deploy de produção aplica as migrations no banco da
// demonstração. As prévias de PR não mexem no banco.
import { execSync } from 'node:child_process';

function rodar(comando, env = {}) {
  execSync(comando, { stdio: 'inherit', env: { ...process.env, ...env } });
}

// O client do Prisma é gerado no postinstall, mas a Vercel reaproveita o
// node_modules do build anterior e, sem mudança no lockfile, a instalação não
// roda o postinstall. Por isso o build gera o client sempre.
rodar('pnpm exec prisma generate');
rodar('pnpm --filter @eloconnect/shared build');

if (process.env.VERCEL_ENV === 'production') {
  // As migrations usam a conexão direta do Neon, sem o pooler.
  rodar('pnpm exec prisma migrate deploy', {
    DATABASE_URL:
      process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  });
}

rodar('pnpm run build');
