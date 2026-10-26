# Demonstração na Vercel

Como a demonstração do PI está publicada. A decisão e as alternativas avaliadas estão no item Hospedagem do [decisoes-tecnicas.md](decisoes-tecnicas.md). A demonstração usa só dados fictícios.

## Projetos

São dois projetos na Vercel, ligados ao mesmo repositório:

| Projeto | Pasta (Root Directory) | Endereço |
| --- | --- | --- |
| `eloconnect` | `apps/web` | <https://eloconnect.vercel.app> |
| `eloconnect-api` | `apps/api` | <https://eloconnect-api.vercel.app> |

- As telas encaminham `/api` para a API (`apps/web/vercel.json`), como o Vite faz em desenvolvimento. O navegador fala com um endereço só, então não há CORS.
- A API roda como uma função da Vercel (NestJS sem configuração). O build (`apps/api/scripts/vercel-build.mjs`) compila o `packages/shared` e, só no deploy de produção, aplica as migrations.
- Cada merge no `main` publica as duas. A Vercel pula o projeto que não mudou.

## Banco (Neon)

Criado pelo painel da Vercel (Storage → Neon) e ligado ao projeto `eloconnect-api`, só no ambiente Production, na mesma região da API. A integração cria duas variáveis:

- `DATABASE_URL`: conexão com o pooler, usada pela API;
- `DATABASE_URL_UNPOOLED`: conexão direta, usada nas migrations.

## Variáveis do projeto `eloconnect-api`

Ficam só no painel da Vercel, nunca no repositório.

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` e `DATABASE_URL_UNPOOLED` | Criadas pela integração com o Neon |
| `JWT_SECRET` | Gerada na sua máquina com `openssl rand -base64 48` |
| `WEB_URL` | `https://eloconnect.vercel.app` |

O SMTP fica sem configurar. A recuperação de senha responde normalmente, mas o e-mail não sai enquanto não houver provedor (P12). Quando houver, o envio depois da resposta precisa do `waitUntil` do `@vercel/functions`, para a função não ser suspensa antes de o e-mail sair. Ele ficou de fora por enquanto: sem e-mail não teria efeito, e hoje o pacote traz uma dependência com vulnerabilidade conhecida (`zod`, via `@vercel/oidc`).

## Dados fictícios (seed)

Rode uma vez, da sua máquina, depois do primeiro deploy. Copie a `DATABASE_URL_UNPOOLED` do painel do Neon e use direto no comando, sem salvar em arquivo. Comece a linha com um espaço, para ela não ficar no histórico do terminal:

```bash
 DATABASE_URL='<cole aqui a DATABASE_URL_UNPOOLED>' pnpm --filter api db:seed
```

Os usuários são os mesmos de desenvolvimento (README). A senha deles é pública, então qualquer pessoa com o link entra como admin. Para uma demonstração com dados fictícios isso é aceitável, mas avise quem for ver.

## Prévias de PR

Cada PR ganha um endereço de prévia das telas, que usa a API e o banco da demonstração. Por padrão, a Vercel pode pedir login para abrir as prévias.

As prévias da API ficam para depois. Elas precisam de um banco separado para cada prévia (branch do Neon), para nenhuma PR mexer no banco da demonstração.
