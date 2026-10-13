// Prepara o ambiente de desenvolvimento depois do `pnpm install`: confere o
// Node e o Docker, cria o .env da API, sobe o banco, gera o client do Prisma,
// aplica as migrations, roda o seed e compila o shared. Pode ser rodado de
// novo sem apagar nada, inclusive depois de um `git pull`.
// Para recriar o banco do zero: `pnpm --filter api db:reset`.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(import.meta.dirname, '..');

function falhar(mensagem) {
  console.error(`\n✖ ${mensagem}`);
  process.exit(1);
}

function rodar(titulo, comando, args, dica) {
  console.log(`\n▶ ${titulo}`);
  const { status } = spawnSync(comando, args, { cwd: raiz, stdio: 'inherit' });
  if (status !== 0) falhar(dica);
}

const nodeEsperado = readFileSync(join(raiz, '.nvmrc'), 'utf8').trim();
if (process.versions.node.split('.')[0] !== nodeEsperado) {
  falhar(
    `Este projeto usa o Node ${nodeEsperado}, e você está com o ${process.versions.node}. Rode \`nvm install\` na raiz do projeto.`,
  );
}

if (!existsSync(join(raiz, 'node_modules'))) {
  falhar('As dependências não estão instaladas. Rode `pnpm install` antes.');
}

const docker = spawnSync('docker', ['info'], { stdio: 'ignore' });
if (docker.error || docker.status !== 0) {
  falhar(
    'O Docker não está rodando. Abra o Docker Desktop e confira se a integração com o WSL está ligada (Settings → Resources → WSL integration).',
  );
}

const env = join(raiz, 'apps/api/.env');
if (existsSync(env)) {
  console.log('\n✔ apps/api/.env já existe e foi mantido.');
} else {
  copyFileSync(join(raiz, 'apps/api/.env.example'), env);
  console.log('\n✔ apps/api/.env criado a partir do .env.example.');
}

rodar(
  'Subindo o banco (PostgreSQL no Docker)',
  'docker',
  ['compose', 'up', '-d', '--wait'],
  'Não foi possível subir o banco. Se a porta 5432 estiver ocupada, veja "Problemas comuns" no README.',
);
rodar(
  'Gerando o client do Prisma',
  'pnpm',
  ['--filter', 'api', 'exec', 'prisma', 'generate'],
  'Não foi possível gerar o client do Prisma. Confira o apps/api/prisma/schema.prisma.',
);
rodar(
  'Aplicando as migrations',
  'pnpm',
  ['--filter', 'api', 'db:deploy'],
  'As migrations falharam. Confira o DATABASE_URL em apps/api/.env.',
);
rodar(
  'Rodando o seed (dados fictícios)',
  'pnpm',
  ['--filter', 'api', 'db:seed'],
  'O seed falhou. Para recriar o banco do zero: pnpm --filter api db:reset',
);
rodar(
  'Compilando o pacote shared',
  'pnpm',
  ['--filter', '@eloconnect/shared', 'build'],
  'A compilação do packages/shared falhou.',
);

console.log('\n✔ Tudo pronto. Rode `pnpm dev` e abra http://localhost:5173');
