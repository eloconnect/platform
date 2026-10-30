# Demonstração na Vercel

Como a demonstração do PI está publicada. A decisão e as alternativas avaliadas estão no item Hospedagem do [decisoes-tecnicas.md](decisoes-tecnicas.md). A demonstração usa só dados fictícios.

## Projetos

São dois projetos na Vercel, ligados ao mesmo repositório:

| Projeto | Pasta (Root Directory) | Endereço |
| --- | --- | --- |
| `eloconnect` | `apps/web` | <https://eloconnect.vercel.app> |
| `eloconnect-api` | `apps/api` | <https://eloconnect-api.vercel.app> |

- As telas encaminham `/api` para a API (`apps/web/vercel.json`), como o Vite faz em desenvolvimento. O navegador fala com um endereço só, então não há CORS.
- A API roda como uma função da Vercel (NestJS sem configuração). O build (`apps/api/scripts/vercel-build.mjs`) gera o client do Prisma, compila o `packages/shared` e, só no deploy de produção, aplica as migrations. O client é gerado no próprio build porque a Vercel reaproveita o `node_modules` do deploy anterior e, quando o lockfile não muda, a instalação não roda o `postinstall`.
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
| `EMAIL_SO_NO_LOG` | `true` |

O SMTP fica sem configurar, e o e-mail não sai enquanto não houver provedor (P12). Com `EMAIL_SO_NO_LOG=true`, a API escreve cada e-mail no log, com os links, em vez de enviar. É assim que a equipe testa a criação de conta e a recuperação de senha na demonstração: faça o pedido nas telas e abra o log da função em Logs, no projeto `eloconnect-api`. Os e-mails do seed são fictícios (`@example.com`), e o log só a equipe vê. **Nunca ligue essa variável no sistema do cliente**: os links dão acesso às contas.

Quando houver provedor, o envio depois da resposta precisa do `waitUntil` do `@vercel/functions`, para a função não ser suspensa antes de o e-mail sair. Ele ficou de fora por enquanto: sem e-mail não teria efeito, e hoje o pacote traz uma dependência com vulnerabilidade conhecida (`zod`, via `@vercel/oidc`).

## PDFs das convenções (Vercel Blob)

Os PDFs ficam num armazenamento Vercel Blob **privado**, ligado ao projeto `eloconnect-api` só no ambiente Production. Para criar: na aba Storage do projeto `eloconnect-api`, Create Storage → Blob → Continue, com o acesso **Private**. A Vercel cria a variável `BLOB_STORE_ID` e autentica a API sozinha, sem senha no painel (OIDC). Depois de ligar, faça um Redeploy da API.

Os arquivos não têm endereço público: a API lê o PDF e repassa só para quem pode abrir. Fora da Vercel, sem o Blob, a API guarda os PDFs na pasta `ARQUIVOS_DIR`, que serve só para desenvolvimento e testes. Na Vercel, sem o Blob, o envio responde 503.

O plano grátis tem 1 GB. Cada PDF pode ter até 4 MB (P24).

## Variáveis do projeto `eloconnect`

| Variável | Valor |
| --- | --- |
| `VITE_EMAIL_PEDIDO_CADASTRO` | E-mail que o sindicato vai informar para as farmácias pedirem o cadastro (P19). Enquanto não houver, fica sem configurar, e a página inicial orienta a falar com a sede. |

As variáveis `VITE_` entram no código das telas no build, então qualquer pessoa vê o valor: só use para dados públicos, como esse e-mail. Depois de mudar, faça um Redeploy do projeto.

## Dados fictícios (seed)

Rode uma vez, da sua máquina, depois do primeiro deploy. Copie a `DATABASE_URL_UNPOOLED` do painel do Neon e use direto no comando, sem salvar em arquivo. Comece a linha com um espaço, para ela não ficar no histórico do terminal:

```bash
 DATABASE_URL='<cole aqui a DATABASE_URL_UNPOOLED>' SEED_SENHA='<senha da equipe>' pnpm --filter api db:seed
```

Os usuários são os mesmos de desenvolvimento (README), mas a senha é a da `SEED_SENHA`, combinada só com a equipe. Sem ela, o seed usa a senha pública de desenvolvimento, e qualquer pessoa com o link entraria como admin.

### Recriar o banco da demonstração

Para trocar a senha ou voltar aos dados iniciais. **Apaga todos os dados da demonstração**, reaplica as migrations e roda o seed:

```bash
 DATABASE_URL='<cole aqui a DATABASE_URL_UNPOOLED>' SEED_SENHA='<senha da equipe>' pnpm --filter api db:reset
```

## Prévias de PR

Cada PR ganha um endereço de prévia das telas, que usa a API e o banco da demonstração. Por padrão, a Vercel pode pedir login para abrir as prévias.

As prévias da API ficam para depois. Elas precisam de um banco separado para cada prévia (branch do Neon), para nenhuma PR mexer no banco da demonstração.
