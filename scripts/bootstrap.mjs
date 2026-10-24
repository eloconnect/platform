// Prepara o ambiente de desenvolvimento depois do `pnpm install`: confere o
// Node e o Docker, cria ou completa o .env da API, sobe o banco e o Mailpit,
// gera o client do Prisma,
// aplica as migrations, roda o seed e compila o shared. Pode ser rodado de
// novo sem apagar nada, inclusive depois de um `git pull`.
// Para recriar o banco do zero: `pnpm --filter api db:reset`.
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  readFileSync,
} from 'node:fs';
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

// O Node principal vem do .nvmrc, e a versão mínima, do engines do package.json.
const nodeEsperado = readFileSync(join(raiz, '.nvmrc'), 'utf8').trim();
const nodeMinimo = JSON.parse(
  readFileSync(join(raiz, 'package.json'), 'utf8'),
).engines.node.replace('>=', '');

function versaoMenor(atual, minima) {
  const a = atual.split('.').map(Number);
  const m = minima.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== m[i]) return a[i] < m[i];
  }
  return false;
}

const nodeAtual = process.versions.node;
if (
  nodeAtual.split('.')[0] !== nodeEsperado ||
  versaoMenor(nodeAtual, nodeMinimo)
) {
  falhar(
    `Este projeto usa o Node ${nodeEsperado}, a partir da ${nodeMinimo}, e você está com o ${nodeAtual}. Rode \`nvm install\` e depois \`corepack enable\` na raiz do projeto.`,
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

// Se o .env já existe, só acrescenta as variáveis novas do .env.example (com os
// comentários delas), sem mexer nas que já estão lá.
const exemplo = join(raiz, 'apps/api/.env.example');
const env = join(raiz, 'apps/api/.env');
const chaveDaLinha = (linha) => /^([A-Z0-9_]+)=/.exec(linha)?.[1];

if (!existsSync(env)) {
  copyFileSync(exemplo, env);
  console.log('\n✔ apps/api/.env criado a partir do .env.example.');
} else {
  const atual = readFileSync(env, 'utf8');
  const existentes = new Set(atual.split('\n').map(chaveDaLinha));
  const novas = [];
  let comentarios = [];
  for (const linha of readFileSync(exemplo, 'utf8').split('\n')) {
    if (linha.startsWith('#')) {
      comentarios.push(linha);
      continue;
    }
    const chave = chaveDaLinha(linha);
    if (chave && !existentes.has(chave)) {
      novas.push({ chave, texto: [...comentarios, linha].join('\n') });
    }
    comentarios = [];
  }

  if (novas.length > 0) {
    const separador = atual.endsWith('\n') ? '\n' : '\n\n';
    appendFileSync(
      env,
      `${separador}${novas.map((nova) => nova.texto).join('\n\n')}\n`,
    );
    console.log(
      `\n✔ apps/api/.env mantido, com as variáveis novas do .env.example: ${novas.map((nova) => nova.chave).join(', ')}.`,
    );
  } else {
    console.log('\n✔ apps/api/.env já existe e foi mantido.');
  }

  if (/^SMTP_HOST="?smtp\.example\.com"?\s*$/m.test(atual)) {
    console.log(
      '\n⚠ O SMTP_HOST do apps/api/.env ainda é o exemplo antigo (smtp.example.com). Para ver os e-mails no Mailpit, use SMTP_HOST="localhost" e SMTP_PORT=1025.',
    );
  }
}

rodar(
  'Subindo o banco (PostgreSQL) e o Mailpit no Docker',
  'docker',
  ['compose', 'up', '-d', '--wait'],
  'Não foi possível subir o banco e o Mailpit. Se a porta 5432, 1025 ou 8025 estiver ocupada, veja "Problemas comuns" no README.',
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

console.log(
  '\n✔ Tudo pronto. Rode `pnpm dev` e abra http://localhost:5173. Os e-mails de desenvolvimento aparecem em http://localhost:8025.',
);
