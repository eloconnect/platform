# API Elo Connect

API NestJS do monorepo Elo Connect. O schema PostgreSQL está em
[`prisma/schema.prisma`](./prisma/schema.prisma); consulte
[`docs/modelo-dados.md`](../../docs/modelo-dados.md) para o diagrama, as
relações e as regras de imutabilidade.

## Banco local

Na raiz do monorepo, configure `apps/api/.env` a partir de
[`apps/api/.env.example`](./.env.example) e inicie o PostgreSQL:

```bash
docker compose up -d db
npm run db:migrate
```

Para criar contas de demonstração, habilite intencionalmente o seed fora de
produção:

```bash
ALLOW_DEMO_SEED=true npm run db:seed
```

O seed usa somente dados fictícios em `example.com`, cria um administrador e
dois associados (adimplente e inadimplente), não sobrescreve contas existentes,
e inclui valores iniciais demonstrativos, benefícios fictícios e um boleto
demonstrativo sem dados de pagamento.
Credenciais de demonstração: `admin@example.com`,
`adimplente@example.com` ou `inadimplente@example.com`; senha
`elloconnect123`.

O boleto `DEMO-*` serve somente para visualizar o portal: não tem código PIX
nem PDF e não pode ser pago. Os valores de R$ 185,00 mensais e R$ 1.776,00
anuais também são somente valores iniciais de demonstração. O histórico de
valores é imutável; futuras alterações do administrador devem ser gravadas
como uma nova vigência.

As rotas `/api/member/*` exigem sessão de associado. A desativação pelo titular
é efetivada imediatamente, registra auditoria, desliga a recorrência e bloqueia
benefícios, convenções e suporte, preservando login e consulta financeira.
As rotas `/api/admin/*` exigem sessão administrativa e suportam o painel, a
gestão de convenções/benefícios e propostas anuais de reajuste. Uma proposta
aprovada só cria uma nova vigência em 1º de janeiro do ano seguinte; a decisão
da diretoria é registrada manualmente após o retorno oficial. O sistema ainda
não notifica a diretoria por e-mail e não possui integração Sicredi ativa.

## API

```bash
npm run start:dev --workspace api
npm run build --workspace api
npm test --workspace api
```

Consulte [`docs/autenticacao.md`](../../docs/autenticacao.md) para os endpoints
de login e recuperação de senha. Nunca use dados reais do cliente nos seeds,
testes ou demonstrações.
