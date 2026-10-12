# Modelo de dados inicial

O schema Prisma em [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma)
define as entidades do MVP. Os nomes físicos das 15 tabelas no PostgreSQL são
em português; os nomes dos modelos no código permanecem em inglês para seguir
o padrão da API.

## Diagrama entidade-relacionamento

```mermaid
erDiagram
    Usuario ||--o| Associado : representa
    Usuario ||--o{ SessaoAutenticacao : possui
    Usuario ||--o{ TokenRedefinicaoSenha : solicita
    Associado ||--o{ Boleto : recebe
    Associado ||--o{ Transacao : possui
    Boleto ||--o{ Transacao : registra
    Usuario ||--o{ Transacao : responsavel
    Usuario ||--o{ ValorContribuicao : registra
    Usuario ||--o{ PropostaValorContribuicao : submete
    Usuario ||--o{ PropostaValorContribuicao : analisa
    Usuario ||--o{ Convencao : publica
    Convencao ||--o{ AnexoConvencao : contem
    Convencao ||--o{ PisoSalarialConvencao : define
    Usuario ||--o{ AnexoConvencao : envia
    Usuario ||--o{ Noticia : publica
    Usuario ||--o{ Beneficio : cadastra
    Associado ||--o{ SolicitacaoCancelamento : solicita
    Usuario ||--o{ SolicitacaoCancelamento : analisa
    Usuario ||--o{ LogAuditoria : executa
    Associado o|--o{ LogAuditoria : contextualiza

    Usuario {
        string id PK
        string email UK
        string passwordHash
        enum role
        boolean isActive
        enum registrationStatus
        datetime registrationRequestedAt
        datetime registrationApprovedAt
        string registrationApprovedByUserId FK
        datetime welcomeEmailSentAt
    }
    Associado {
        string id PK
        string userId FK_UK
        string cnpj UK
        string legalName
        string cnae
        enum status
        boolean recurringBilling
        boolean manuallyBlocked
    }
    Boleto {
        string id PK
        string associateId FK
        string identifier UK
        decimal amount
        date dueDate
        enum status
    }
    Transacao {
        string id PK
        string billId FK
        string associateId FK
        string identifierSnapshot
        decimal amount
        enum status
        enum paymentMethod
        datetime occurredAt
        string responsibleUserId FK
    }
    ValorContribuicao {
        string id PK
        decimal monthlyAmount
        decimal annualAmount
        date effectiveFrom
        string createdByUserId FK
        datetime createdAt
    }
    PropostaValorContribuicao {
        string id PK
        decimal monthlyAmount
        decimal annualAmount
        int annualDiscountPercent
        date effectiveFrom
        enum status
        string note
        string decisionNote
        datetime submittedAt
        string submittedByUserId FK
        datetime reviewedAt
        string reviewedByUserId FK
    }
    Convencao {
        string id PK
        string title
        string summary
        date effectiveFrom
        date effectiveUntil
        datetime publishedAt
        string createdByUserId FK
    }
    AnexoConvencao {
        string id PK
        string conventionId FK
        string fileName
        string url
        string uploadedByUserId FK
    }
    PisoSalarialConvencao {
        string id PK
        string conventionId FK
        string jobTitle
        decimal floorAmount
        datetime createdAt
        datetime updatedAt
    }
    Noticia {
        string id PK
        string title
        string content
        datetime publishedAt
        string createdByUserId FK
    }
    Beneficio {
        string id PK
        string title
        string description
        boolean isActive
        string createdByUserId FK
    }
    SolicitacaoCancelamento {
        string id PK
        string associateId FK
        enum status
        datetime requestedAt
        datetime reviewedAt
        string reviewedByUserId FK
    }
    LogAuditoria {
        string id PK
        string actorUserId FK
        string associateId FK
        string action
        string entity
        string entityId
        json previousValues
        json newValues
        datetime occurredAt
    }
    SessaoAutenticacao {
        string id PK
        string userId FK
        string tokenHash UK
        datetime expiresAt
        datetime revokedAt
    }
    TokenRedefinicaoSenha {
        string id PK
        string userId FK
        string tokenHash UK
        datetime expiresAt
        datetime usedAt
    }
```

`ValorContribuicao` guarda uma linha por alteração: valores anteriores não são
atualizados, compondo o histórico exigido por RN16. Não há uma tabela separada
de participação em convenção, porque o significado de inscrição continua
pendente (P05).

`PropostaValorContribuicao` guarda, separadamente, os reajustes ainda sujeitos à
homologação da diretoria. O administrador informa o valor anual à vista; o
equivalente mensal é calculado com desconto anual de 20%. A proposta pendente
não altera o valor vigente. Após registrar a homologação recebida da diretoria,
a API cria uma linha append-only em `ValorContribuicao`, com vigência em 1º de
janeiro do próximo ano. A recusa é mantida no histórico da proposta sem criar
um valor efetivo.

`PisoSalarialConvencao` mantém os cargos e respectivos pisos mensais definidos
em cada convenção. A tabela é administrada junto com o resumo da convenção,
registrada nos valores anterior e novo da auditoria, e publicada na consulta
das convenções pelos associados. Valores monetários são armazenados com duas
casas decimais.

Cadastros públicos criam `Usuario` com `registrationStatus=PENDING_APPROVAL` e
`isActive` falso, além do registro `Associado` inicialmente inadimplente. A
solicitação aparece imediatamente na fila da administração. A aprovação ativa
o login e registra quem aprovou e quando, sem ativar a contribuição sindical.
O e-mail que confirma a aprovação e identifica a farmácia é registrado em
`welcomeEmailSentAt`; uma falha de entrega mantém o cadastro aprovado na fila
administrativa para permitir nova tentativa.

`DesafioCodigoEmail` guarda os hashes do desafio e do código de uso único, a
finalidade, expiração, tentativas, reenvios e data de consumo. O valor do
código nunca é persistido. No fluxo atual, o OTP é usado no login; códigos
válidos por dez minutos são consumidos transacionalmente, e a sessão só é
criada junto com o consumo do desafio após a confirmação do segundo fator.

## Integridade e imutabilidade

- `Transacao`, `ValorContribuicao` e `LogAuditoria` são somente de inclusão.
  Triggers PostgreSQL rejeitam `UPDATE`, `DELETE` e `TRUNCATE`, inclusive quando
  a operação não passa pelo Prisma. Correções são registradas por novos eventos
  ou novos valores, sem editar o histórico.
- Propostas de reajuste possuem estado próprio (`PENDING_HOMOLOGATION`,
  `APPROVED` ou `REJECTED`) e guardam separadamente a justificativa inicial e
  o retorno da diretoria. Toda submissão e decisão gera auditoria.
- Transações mantêm cópia do identificador e do valor do boleto no momento do
  evento. O responsável humano é opcional para permitir eventos automáticos de
  pagamento; ações humanas devem registrar o usuário responsável.
- Chaves estrangeiras históricas usam `RESTRICT` para impedir que a remoção de
  usuários ou associados apague transações, alterações de valor ou auditorias.
- O CNPJ é armazenado com 14 dígitos e tem verificação de formato no banco.
- A migration mantém os usuários/sessões/tokens da autenticação existentes e
  renomeia suas tabelas para português, sem descartá-los.
- A desativação de associação é registrada em `SolicitacaoCancelamento` com
  estado `EFETIVADO`, atualiza `Associado` para `CANCELADO`, encerra a cobrança
  recorrente e registra a ação em `LogAuditoria` na mesma transação.
- A conta (`Usuario`) e o acesso à consulta financeira permanecem ativos após
  a desativação. A API bloqueia benefícios, convenções e suporte para
  associações canceladas.

## Migration e seed de desenvolvimento

Na raiz do monorepo, com `apps/api/.env` configurado e o PostgreSQL disponível:

```bash
npm run db:migrate
npm run db:seed
```

O seed exige a confirmação explícita `ALLOW_DEMO_SEED=true`, recusa ambiente de
produção e não sobrescreve contas preexistentes. Cria somente contas e
associados fictícios (`@example.com`, CNPJs de exemplo com dígitos
verificadores válidos), com a senha de demonstração `elloconnect123`. Não cria
dados reais do cliente. Os valores iniciais de demonstração são R$ 185,00
mensais e R$ 1.776,00 anuais; podem ser substituídos por novas vigências,
mantendo o histórico append-only. O boleto `DEMO-*` não contém PIX ou PDF e
não pode ser pago. Benefícios são fictícios e as convenções só aparecem quando
um documento oficial for publicado e anexado.
