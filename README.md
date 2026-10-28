# Elo Connect

[![CI](https://github.com/eloconnect/platform/actions/workflows/ci.yml/badge.svg)](https://github.com/eloconnect/platform/actions/workflows/ci.yml)

Plataforma web de um sindicato patronal de farmácias e drogarias de Mato Grosso: cobrança mensal automatizada (boleto e Pix via Sicredi), central de convenções coletivas, notícias, benefícios e gestão de associados, com interface pensada para um público majoritariamente idoso. Projeto Integrador do curso de DSM da FATEC Itapira, com cliente real.

## Documentação

- [Requisitos](docs/requisitos.md): regras de negócio, requisitos e pendências com o cliente.
- [Decisões técnicas](docs/decisoes-tecnicas.md): escopo do MVP, stack e ferramentas.
- [Modelo de dados](docs/modelo-dados.md): DER e decisões do banco.
- [ADRs](docs/adr/): decisões de arquitetura.
- [Registro da entrevista](docs/registro-entrevista.md) com o cliente.
- [Como contribuir](CONTRIBUTING.md): fluxo de PR, commits e regra de dados fictícios.
- Backlog: [Elo Connect - MVP](https://github.com/orgs/eloconnect/projects/1) no GitHub Projects.

## Stack

| Parte | Tecnologia |
| --- | --- |
| Web | React + Vite (TypeScript), React Bootstrap |
| API | NestJS (TypeScript), Prisma 7 |
| Banco | PostgreSQL 17 (Docker Compose em desenvolvimento) |
| Monorepo | pnpm workspaces, Node.js 24 |
| Qualidade | oxlint, Prettier, Jest, Vitest e CI no GitHub Actions |

## Estrutura

```text
apps/
  api/       API NestJS (prefixo /api), schema do Prisma, migrations e seed
  web/       front-end React + Vite
packages/
  shared/    tipos e cliente HTTP da API, usados pelo web e pela API
docs/        requisitos, decisões técnicas e modelo de dados
scripts/     bootstrap do ambiente de desenvolvimento
```

## Pré-requisitos

No Windows, o projeto roda no **WSL2** (Ubuntu). Tudo abaixo é feito no terminal do WSL.

1. **Pasta do projeto no WSL**, por exemplo `~/projetos`. Não use `/mnt/c/...`: o acesso ao disco do Windows deixa a instalação e o build muito lentos.
2. **Docker**: Docker Desktop no Windows com a integração do WSL ligada (Settings → Resources → WSL integration), ou o Docker Engine instalado no próprio WSL. Confira com `docker info`.
3. **Node.js 24, a partir da 24.22.1**, pelo [nvm](https://github.com/nvm-sh/nvm). A versão principal está no `.nvmrc`, e a mínima, no `engines` do `package.json`.
4. **pnpm** pelo corepack, que já vem com o Node. A versão está no `package.json`.

## Como rodar

```bash
git clone https://github.com/eloconnect/platform.git ~/projetos/platform
cd ~/projetos/platform
nvm install        # instala e ativa o Node do .nvmrc
corepack enable    # ativa o pnpm na versão do projeto
pnpm install
pnpm bootstrap
pnpm dev
```

O `pnpm bootstrap` prepara tudo de uma vez:

1. confere a versão do Node e se o Docker está rodando;
2. cria o `apps/api/.env` a partir do `.env.example`, se ele ainda não existir;
3. sobe o PostgreSQL no Docker e espera ele ficar pronto;
4. gera o client do Prisma;
5. aplica as migrations;
6. roda o seed com dados fictícios;
7. compila o `packages/shared`.

Ele pode ser rodado de novo sem apagar nada. Depois de um `git pull` que mexa no banco ou no shared, rode `pnpm bootstrap` outra vez.

O `pnpm dev` sobe a API, o web e o shared juntos, recarregando a cada alteração:

- Web: <http://localhost:5173> (a página `/status` mostra se a API e o banco estão ok).
- API: <http://localhost:3000/api> (`GET /api/health` confere a API e o banco).
- E-mails: <http://localhost:8025> (caixa de entrada do Mailpit, ver abaixo).

### Usuários de desenvolvimento

O seed cria só dados fictícios. A senha de todos é `eloconnect123`.

| E-mail | Perfil |
| --- | --- |
| `admin@example.com` | Administrador chave mestre (todas as funções) |
| `sede@example.com` | Administrador básico (publica conteúdo e consulta associados) |
| `associado@example.com` | Associado adimplente |
| `inadimplente@example.com` | Associado inadimplente |

### E-mails em desenvolvimento

Os e-mails da API (por exemplo, o link de recuperação de senha) vão para o Mailpit, que sobe junto com o banco no `pnpm bootstrap`. Eles aparecem na caixa de entrada <http://localhost:8025> e não saem da sua máquina: o Mailpit não reenvia nada para fora, mesmo que o destinatário seja um e-mail real, e as mensagens somem quando o container para.

Para testar a recuperação de senha de ponta a ponta:

1. Com o `pnpm dev` rodando, abra <http://localhost:5173/esqueci-senha> e informe `associado@example.com`.
2. Abra <http://localhost:8025>, entre no e-mail "Redefinição de senha" e clique no link.
3. Crie a nova senha e entre com ela em <http://localhost:5173/entrar>.

Para testar a criação de conta pelo CNPJ (RF05):

1. Abra <http://localhost:5173/cadastro> e informe o CNPJ da Farmácia Exemplo 02, `41.015.838/0001-36`, que está no cadastro e ainda não tem conta.
2. Abra <http://localhost:8025>, entre no e-mail "Crie sua senha" e clique no link.
3. Crie a senha e entre em <http://localhost:5173/entrar> com `farmacia02@example.com`.

Para voltar à senha `eloconnect123` e apagar as contas criadas, rode `pnpm --filter api db:reset`.

O banco e o Mailpit só aceitam conexões da própria máquina, porque as senhas de desenvolvimento estão no repositório.

## Demonstração

A demonstração do PI fica em <https://eloconnect.vercel.app>, com os mesmos usuários fictícios do seed (tabela acima). Ela é atualizada sozinha a cada merge no `main`.

- Os dados são fictícios e podem ser recriados a qualquer momento.
- A demonstração não envia e-mail, porque ainda não há provedor (P12). Os e-mails de recuperação de senha e de criação de conta, com os links, aparecem no log da API na Vercel, que só a equipe vê ([docs/deploy.md](docs/deploy.md)).
- Depois de um tempo sem acesso, a primeira resposta pode demorar alguns segundos.

Como ela está configurada: [docs/deploy.md](docs/deploy.md).

## Comandos

Todos rodam na raiz do projeto.

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Sobe API, web e shared com recarga automática |
| `pnpm build` | Build de todos os pacotes |
| `pnpm test` | Testes unitários (Jest na API, Vitest no web e no shared) |
| `pnpm --filter api test:e2e` | Testes e2e da API (precisa do banco no ar). Rodam num banco separado, `eloconnect_test`, criado na primeira vez |
| `pnpm lint` / `pnpm lint:fix` | Lint do monorepo / corrige o que for automático |
| `pnpm format` / `pnpm format:check` | Formata / só confere a formatação |
| `pnpm --filter api db:migrate` | Cria uma migration depois de alterar o schema |
| `pnpm --filter api db:seed` | Roda o seed (não faz nada se o banco já tiver dados) |
| `pnpm --filter api db:reset` | **Apaga** o banco local e recria com migrations e seed |
| `pnpm --filter api db:studio` | Abre o Prisma Studio para ver os dados |
| `docker compose down` | Para o banco e o Mailpit (os dados do banco ficam guardados no volume) |

O CI roda lint, formatação, build, testes e e2e em todo PR, e PR com o CI vermelho não entra no `main`.

## Problemas comuns

- **Porta 5432 ocupada:** há outro PostgreSQL rodando, no WSL ou no Windows. No WSL, pare com `sudo service postgresql stop`; no Windows, pare o serviço "postgresql" em Serviços. Depois rode `pnpm bootstrap` de novo.
- **Porta 1025 ou 8025 ocupada:** há outro Mailpit (ou MailHog) rodando. Pare o outro e rode `pnpm bootstrap` de novo.
- **O e-mail não aparece no Mailpit:** confira se o `apps/api/.env` tem `SMTP_HOST="localhost"` e `SMTP_PORT=1025`. Quem criou o `.env` antes do Mailpit pode estar com o exemplo antigo (`smtp.example.com`); o bootstrap avisa nesse caso.
- **`docker: command not found` ou "Cannot connect to the Docker daemon":** abra o Docker Desktop e confira a integração com o WSL.
- **Versão errada do Node:** rode `nvm install` e depois `corepack enable` na raiz do projeto. O `pnpm install` e o bootstrap recusam versões abaixo da 24.22.1.
- **`pnpm: command not found` depois de instalar um Node novo:** rode `corepack enable`. Ele precisa ser ativado em cada versão do Node instalada pelo nvm.
- **`pnpm` pede aprovação ao adicionar uma dependência:** pacotes com script de instalação precisam ser aprovados com `pnpm approve-builds`. A lista de aprovados fica no `pnpm-workspace.yaml` e entra no PR.
- **A API não encontra `@eloconnect/shared`:** rode `pnpm --filter @eloconnect/shared build` (o bootstrap já faz isso).
- **Erro de tipo do Prisma ou tabela inexistente depois de um `git pull`:** o schema mudou. Rode `pnpm bootstrap`, que gera o client de novo e aplica as migrations novas.

## Dados do cliente

O repositório é público. Nunca entram no Git dados reais do cliente: CNPJs, e-mails, XML da JUCEMAT, credenciais do Sicredi, contrato ou dados do termo de parceria. Seeds, testes e demonstrações usam só dados fictícios. Detalhes no [CONTRIBUTING](CONTRIBUTING.md).
