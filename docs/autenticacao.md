# Autenticação

## Contas, cadastro e aprovação

O formulário público cria solicitações para o perfil `ASSOCIATE`. A pessoa
informa razão social, CNPJ, e-mail e senha; a API valida o CNPJ como dado
cadastral, armazena somente o hash da senha e coloca a farmácia imediatamente
na fila administrativa (`PENDING_APPROVAL`). A conta continua inativa até a
aprovação. Ao aprovar, o administrador libera o login e o sistema envia ao
e-mail informado a confirmação de que o cadastro daquela farmácia foi
aprovado, com o link de acesso. O associado autentica com senha e código OTP
enviado por e-mail no login. A associação começa como inadimplente, e a
aprovação não ativa contribuição sindical nem libera benefícios.

Administradores analisam as solicitações em `/admin/cadastros`. Ao aprovar, a
API ativa o login e envia um e-mail de boas-vindas com o link de acesso. Caso o
SMTP esteja indisponível, a aprovação permanece registrada, a tela informa que
o e-mail não foi enviado e permite tentar o envio novamente. Solicitações e
aprovações ficam registradas na auditoria.

Contas administrativas e contas de serviço continuam podendo ser criadas por
operadores autorizados com `npm run auth:provision --workspace api`, usando
variáveis temporárias no `.env` local da API:

- `PROVISION_EMAIL`: e-mail único da conta.
- `PROVISION_PASSWORD`: senha inicial com ao menos 8 caracteres e até 72 bytes
  UTF-8.
- `PROVISION_ROLE`: `ADMIN` ou `ASSOCIATE`.

O comando valida o e-mail e o perfil, salva somente o hash bcrypt e não altera
uma conta existente. Remova as variáveis de provisionamento depois do uso.

## Endpoints

Todos os endpoints estão sob `/api/auth`:

| Método | Caminho            | Comportamento                                                                                             |
| ------ | ------------------ | --------------------------------------------------------------------------------------------------------- |
| `POST` | `/register`        | Cria cadastro `PENDING_APPROVAL` visível imediatamente para o administrador.                              |
| `POST` | `/email/verify`    | Confirma o OTP do login e emite cookie de sessão.                                                         |
| `POST` | `/email/resend`    | Reenvia o código associado ao desafio, com limite de reenvios.                                            |
| `POST` | `/login`           | Valida e-mail/senha e inicia OTP, exceto para e-mails explicitamente liberados em desenvolvimento/testes. |
| `POST` | `/logout`          | Revoga a sessão atual e remove o cookie.                                                                  |
| `GET`  | `/me`              | Retorna o usuário da sessão; exige autenticação.                                                          |
| `POST` | `/password/forgot` | Solicita e-mail de recuperação; a resposta não confirma se a conta existe.                                |
| `POST` | `/password/reset`  | Consome token de uso único, altera a senha e revoga todas as sessões.                                     |

As rotas `/api/member/*` exigem sessão com perfil `ASSOCIATE`. A desativação da
associação bloqueia imediatamente benefícios, convenções e suporte, encerra a
configuração de cobrança recorrente e mantém a conta e a consulta financeira.
O cookie de sessão cobre o prefixo `/api` para ser enviado tanto às rotas de
autenticação quanto às rotas da área do associado.

As senhas exigem no mínimo 8 caracteres e são limitadas a 72 bytes UTF-8 pelo
bcrypt. Todos os perfis, inclusive administradores, precisam informar o código
de seis dígitos enviado ao e-mail após a senha; a sessão só é criada depois de
validar o código. A única exceção são e-mails explicitamente liberados para
testes em ambientes não produtivos. O login de administrador segue para
`/admin` somente após a etapa exigida para o ambiente. Códigos expiram em 10 minutos, aceitam até cinco tentativas e
armazenam apenas hashes; o desafio também é aleatório, de uso único e limitado
a três reenvios. Tokens de sessão e de recuperação são aleatórios; o banco
armazena somente seus hashes SHA-256. Links de recuperação expiram em uma hora.
O cookie é `HttpOnly` e `SameSite=Strict`, além de `Secure` em produção. O
limite de requisições é de 60 por minuto no padrão, com limites menores para
login (5), OTP (5) e recuperação (3), por instância da API.

Sem “Lembrar neste dispositivo”, a sessão do servidor expira em 8 horas e o
cookie é de sessão do navegador. Com a opção marcada, a sessão e o cookie
expiram em 30 dias.

## Ambiente

Configure `apps/api/.env` a partir de `.env.example`:

| Variável                                | Uso                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                          | Conexão PostgreSQL usada pelo Prisma.                                                                         |
| `WEB_ORIGIN`                            | Origem canônica da aplicação web; define a origem dos links de redefinição.                                   |
| `CORS_ORIGINS`                          | Lista opcional de origens permitidas, separadas por vírgula; por padrão usa `WEB_ORIGIN`.                     |
| `COOKIE_SECURE`                         | Ative em desenvolvimento HTTPS; em produção o cookie é sempre seguro.                                         |
| `AUTH_OTP_BYPASS_EMAILS`                | Lista opcional de e-mails de teste separados por vírgula; só vale em `development`/`test`, nunca em produção. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Servidor SMTP; `SMTP_SECURE=true` para TLS implícito, normalmente na porta 465.                               |
| `SMTP_USER`, `SMTP_PASSWORD`            | Credenciais opcionais, mas devem ser fornecidas juntas.                                                       |
| `SMTP_FROM`                             | Remetente usado nas mensagens OTP, recuperação e boas-vindas após aprovação.                                  |

Os códigos OTP de login, a confirmação de aprovação e a solicitação de
recuperação exigem configuração SMTP completa. Uma falha no OTP é comunicada
na tela e permite solicitar reenvio; falha no e-mail de aprovação deixa a
solicitação aprovada disponível na administração para nova tentativa. Verifique
os logs da API para diagnosticar falhas de SMTP. A recuperação de senha mantém
resposta genérica para evitar revelar a existência de contas.

O envio de boas-vindas ocorre somente depois da aprovação e ativação da conta.
Se a entrega falhar, a API registra a falha e a tela administrativa mantém a
solicitação na fila para permitir novo envio após corrigir a configuração SMTP.

Em produção, publique a aplicação somente por HTTPS, configure as origens
corretas em `WEB_ORIGIN` e mantenha credenciais fora do controle de versão.
Para testar logins sem receber OTP, defina `AUTH_OTP_BYPASS_EMAILS` com os
endereços exatos de teste e use `NODE_ENV=development` (ou `test`). O bypass
é sempre ignorado quando `NODE_ENV=production`.
