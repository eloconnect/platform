# Elo Connect

Plataforma web do sindicato patronal de farmácias e drogarias de Mato Grosso.
O MVP centraliza informações do setor e automatiza a cobrança dos associados,
com uma interface simples, responsiva e acessível.

## Stack

- Web: React, Vite e TypeScript (`apps/web`)
- API: NestJS (`apps/api`)
- Banco de dados: PostgreSQL 17 via Docker Compose
- Monorepo: npm workspaces e Node.js 24
- Componentes web: React Bootstrap e Bootstrap 5

## Estado da aplicação web

- `/`: vitrine pública do sindicato, com apresentação institucional,
  convenções coletivas, informações do setor e chamadas visíveis para entrar e
  criar conta.
- `/login`: autenticação por e-mail e senha; contas precisam ser provisionadas
  previamente e a sessão é mantida em cookie `HttpOnly`.
- `/cadastro`: informa que a criação de contas depende da confirmação da
  pendência P03; não coleta dados nem simula um fluxo de cadastro.
- `/recuperar-senha`: solicita um link de recuperação enviado por SMTP, sem
  revelar se o e-mail está cadastrado.
- `/redefinir-senha?token=...`: valida o token de uso único, atualiza a senha e
  revoga as sessões existentes.
- `/associado`: área autenticada do associado, com início, boletos, benefícios,
  convenções coletivas, notícias, suporte e solicitação de desativação.
- `/admin`: painel executivo, consulta de associados, manutenção de convenções
  e benefícios e propostas anuais de reajuste, exclusivo para administradores.
- A proposta anual aplica o desconto de 20% para calcular o equivalente
  mensal, permanece pendente de homologação e, quando aprovada, fica agendada
  para 1º de janeiro do próximo ano. A tela não envia mensagens à diretoria.
- O cookie de sessão é `HttpOnly`, `SameSite=Strict` e restrito às rotas da API
  (`/api`) para autenticar a área do associado.
- Benefícios e suporte exigem status adimplente e ausência de bloqueio manual.
  Inadimplentes podem consultar apenas as informações gerais das convenções;
  associados desativados não acessam benefícios, convenções ou suporte.
- A desativação confirmada pelo associado encerra imediatamente a associação e
  a cobrança recorrente, sem aprovação da sede. O login e a consulta de boletos
  e pagamentos permanecem disponíveis.
- A integração de cobrança Sicredi ainda não está configurada; a ação de envio
  de lotes permanece desabilitada e não simula a emissão de boletos.
- Os benefícios e convenções da área do associado são carregados do banco;
  somente conteúdos publicados pelo sindicato são exibidos.
- Os números exibidos na vitrine são estimativas registradas na entrevista com
  o cliente e precisam ser confirmados antes de uma publicação oficial.
- A imagem da equipe de farmácia está em
  `apps/web/public/images/farmacia-equipe.png` e foi preparada a partir da
  referência visual compartilhada para o wireframe.

## Desenvolvimento no Linux/WSL

Para melhor desempenho no WSL, mantenha o repositório no sistema de arquivos
Linux (por exemplo, `~/projetos/platform`), e não em `/mnt/c`.

Instale Node.js 24 (com npm) e execute a instalação na raiz deste repositório
(a mesma pasta deste `README.md` e do `package.json`), nunca na pasta que contém
o clone:

```bash
npm install
```

Os scripts de instalação das ferramentas de build necessárias estão aprovados
no campo `allowScripts` do `package.json` da raiz.

Inicie a aplicação web:

```bash
npm run dev --workspace @eloconnect/web
```

O Vite estará disponível em `http://localhost:5173`. As chamadas iniciadas em
`/api` são encaminhadas para `http://localhost:3000`, endereço da API NestJS em
desenvolvimento.

A vitrine pública fica em `/`, a tela de login em `/login`, a área do associado
em `/associado` e as telas de recuperação e redefinição de senha em
`/recuperar-senha` e `/redefinir-senha?token=...`.

Para iniciar também a API, em outro terminal, suba o PostgreSQL e configure o
arquivo local de ambiente da API:

```bash
docker compose up -d db
cp apps/api/.env.example apps/api/.env
npm run start:dev --workspace api
```

Depois de iniciar o banco, aplique as migrations e gere o Prisma Client:

```bash
npm run db:migrate --workspace api
npm run db:generate --workspace api
```

Para criar as contas fictícias de demonstração, habilite o seed explicitamente
fora de produção:

```bash
# Linux/WSL
ALLOW_DEMO_SEED=true npm run db:seed
```

No PowerShell, use `$env:ALLOW_DEMO_SEED="true"; npm run db:seed` e remova a
variável depois com `Remove-Item Env:ALLOW_DEMO_SEED`. O seed cria
`admin@example.com`, `adimplente@example.com` e `inadimplente@example.com`, com
a senha fictícia `elloconnect123`; não altera contas existentes. Também cria
valores iniciais demonstrativos de R$ 185,00 por mês e R$ 1.776,00 por ano,
benefícios fictícios e um boleto sem PIX ou PDF, impossível de pagar.

Configure SMTP e a origem da web em `apps/api/.env` antes de habilitar a
recuperação de senha. Para criar uma conta administrativa inicial, defina
temporariamente `PROVISION_EMAIL`, `PROVISION_PASSWORD` e `PROVISION_ROLE=ADMIN`
nesse arquivo local e execute:

```bash
npm run auth:provision --workspace api
```

O comando cria apenas contas novas, gera o hash bcrypt e falha se o e-mail já
existir. Remova as variáveis de provisionamento do `.env` após o uso. Consulte
[docs/autenticacao.md](./docs/autenticacao.md) para os endpoints, variáveis e
detalhes operacionais.

Não versione arquivos `.env` nem dados reais do cliente. Para gerar a versão de
produção da web:

```bash
npm run build --workspace @eloconnect/web
```
