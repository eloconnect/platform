# API

Back-end do Elo Connect em NestJS. Para preparar o ambiente, siga o [README da raiz](../../README.md).

- Prefixo global `/api`. O `GET /api/health` confere a API e a conexão com o banco.
- Variáveis de ambiente no `.env`, criado pelo `pnpm bootstrap` a partir do `.env.example`.
- Schema do banco em `prisma/schema.prisma`, documentado em [Modelo de dados](../../docs/modelo-dados.md).
- O client do Prisma é gerado no `postinstall`, em `src/generated/prisma`, e fica fora do Git.
- Seed com dados fictícios em `prisma/seed.ts`.

## Comandos

Na raiz, use `pnpm --filter api <comando>`. Dentro de `apps/api`, use `pnpm <comando>`.

| Comando | O que faz |
| --- | --- |
| `dev` | Sobe a API com recarga automática em <http://localhost:3000/api> |
| `test` | Testes unitários (Jest) |
| `test:e2e` | Testes e2e, contra o banco do `DATABASE_URL` |
| `db:migrate` | Cria e aplica uma migration nova a partir do schema |
| `db:deploy` | Aplica as migrations pendentes, sem criar novas |
| `db:seed` | Roda o seed (não faz nada se o banco já tiver dados) |
| `db:reset` | **Apaga** o banco local e recria com migrations e seed |
| `db:studio` | Abre o Prisma Studio |

## Alterando o banco

1. Edite o `prisma/schema.prisma` e atualize o `docs/modelo-dados.md`.
2. Rode `pnpm --filter api db:migrate --name descricao-curta`.
3. Faça o commit do schema junto com a pasta da migration criada em `prisma/migrations`.

Uma migration que já está no `main` nunca é editada: qualquer correção vira uma migration nova.
