-- Rename the existing authentication tables instead of recreating them.
ALTER TYPE "UserRole" RENAME TO "PerfilUsuario";
ALTER TABLE "User" RENAME TO "Usuario";
ALTER TABLE "AuthSession" RENAME TO "SessaoAutenticacao";
ALTER TABLE "PasswordResetToken" RENAME TO "TokenRedefinicaoSenha";
ALTER TABLE "Usuario" RENAME CONSTRAINT "User_pkey" TO "Usuario_pkey";
ALTER TABLE "SessaoAutenticacao" RENAME CONSTRAINT "AuthSession_pkey" TO "SessaoAutenticacao_pkey";
ALTER TABLE "TokenRedefinicaoSenha" RENAME CONSTRAINT "PasswordResetToken_pkey" TO "TokenRedefinicaoSenha_pkey";
ALTER TABLE "SessaoAutenticacao" RENAME CONSTRAINT "AuthSession_userId_fkey" TO "SessaoAutenticacao_userId_fkey";
ALTER TABLE "TokenRedefinicaoSenha" RENAME CONSTRAINT "PasswordResetToken_userId_fkey" TO "TokenRedefinicaoSenha_userId_fkey";
ALTER INDEX "User_email_key" RENAME TO "Usuario_email_key";
ALTER INDEX "AuthSession_tokenHash_key" RENAME TO "SessaoAutenticacao_tokenHash_key";
ALTER INDEX "AuthSession_userId_expiresAt_idx" RENAME TO "SessaoAutenticacao_userId_expiresAt_idx";
ALTER INDEX "PasswordResetToken_tokenHash_key" RENAME TO "TokenRedefinicaoSenha_tokenHash_key";
ALTER INDEX "PasswordResetToken_userId_expiresAt_idx" RENAME TO "TokenRedefinicaoSenha_userId_expiresAt_idx";

-- CreateEnum
CREATE TYPE "StatusAssociado" AS ENUM ('ADIMPLENTE', 'INADIMPLENTE', 'CANCELAMENTO_SOLICITADO');

-- CreateEnum
CREATE TYPE "StatusBoleto" AS ENUM ('RASCUNHO', 'EM_ABERTO', 'PAGO', 'VENCIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('BOLETO', 'PIX');

-- CreateEnum
CREATE TYPE "StatusTransacao" AS ENUM ('EM_ABERTO', 'PAGO', 'VENCIDO', 'CANCELADO', 'ESTORNADO');

-- CreateEnum
CREATE TYPE "StatusSolicitacaoCancelamento" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO');

-- CreateTable
CREATE TABLE "Associado" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "cnae" TEXT,
    "status" "StatusAssociado" NOT NULL,
    "recurringBilling" BOOLEAN NOT NULL DEFAULT false,
    "manuallyBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Associado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boleto" (
    "id" TEXT NOT NULL,
    "associateId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "StatusBoleto" NOT NULL DEFAULT 'RASCUNHO',
    "pixPayload" TEXT,
    "pdfUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Boleto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transacao" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "associateId" TEXT NOT NULL,
    "identifierSnapshot" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "StatusTransacao" NOT NULL,
    "paymentMethod" "FormaPagamento",
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsibleUserId" TEXT,
    "details" JSONB,

    CONSTRAINT "Transacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValorContribuicao" (
    "id" TEXT NOT NULL,
    "monthlyAmount" DECIMAL(10,2) NOT NULL,
    "annualAmount" DECIMAL(10,2) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "ValorContribuicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Convencao" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "effectiveFrom" DATE,
    "effectiveUntil" DATE,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "Convencao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnexoConvencao" (
    "id" TEXT NOT NULL,
    "conventionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByUserId" TEXT NOT NULL,

    CONSTRAINT "AnexoConvencao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Noticia" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "Noticia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beneficio" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "Beneficio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitacaoCancelamento" (
    "id" TEXT NOT NULL,
    "associateId" TEXT NOT NULL,
    "status" "StatusSolicitacaoCancelamento" NOT NULL DEFAULT 'PENDENTE',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "decisionNote" TEXT,

    CONSTRAINT "SolicitacaoCancelamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "associateId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousValues" JSONB,
    "newValues" JSONB,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Associado_userId_key" ON "Associado"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Associado_cnpj_key" ON "Associado"("cnpj");

-- CreateIndex
CREATE INDEX "Associado_status_idx" ON "Associado"("status");

-- CreateIndex
CREATE INDEX "Associado_recurringBilling_idx" ON "Associado"("recurringBilling");

-- CreateIndex
CREATE UNIQUE INDEX "Boleto_identifier_key" ON "Boleto"("identifier");

-- CreateIndex
CREATE INDEX "Boleto_associateId_dueDate_idx" ON "Boleto"("associateId", "dueDate");

-- CreateIndex
CREATE INDEX "Boleto_status_dueDate_idx" ON "Boleto"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Transacao_associateId_occurredAt_idx" ON "Transacao"("associateId", "occurredAt");

-- CreateIndex
CREATE INDEX "Transacao_billId_occurredAt_idx" ON "Transacao"("billId", "occurredAt");

-- CreateIndex
CREATE INDEX "ValorContribuicao_effectiveFrom_idx" ON "ValorContribuicao"("effectiveFrom");

-- CreateIndex
CREATE INDEX "Convencao_publishedAt_idx" ON "Convencao"("publishedAt");

-- CreateIndex
CREATE INDEX "AnexoConvencao_conventionId_idx" ON "AnexoConvencao"("conventionId");

-- CreateIndex
CREATE INDEX "Noticia_publishedAt_idx" ON "Noticia"("publishedAt");

-- CreateIndex
CREATE INDEX "Beneficio_isActive_idx" ON "Beneficio"("isActive");

-- CreateIndex
CREATE INDEX "SolicitacaoCancelamento_associateId_requestedAt_idx" ON "SolicitacaoCancelamento"("associateId", "requestedAt");

-- CreateIndex
CREATE INDEX "SolicitacaoCancelamento_status_requestedAt_idx" ON "SolicitacaoCancelamento"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "LogAuditoria_actorUserId_occurredAt_idx" ON "LogAuditoria"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "LogAuditoria_associateId_occurredAt_idx" ON "LogAuditoria"("associateId", "occurredAt");

-- CreateIndex
CREATE INDEX "LogAuditoria_action_occurredAt_idx" ON "LogAuditoria"("action", "occurredAt");

-- AddForeignKey
ALTER TABLE "Associado" ADD CONSTRAINT "Associado_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boleto" ADD CONSTRAINT "Boleto_associateId_fkey" FOREIGN KEY ("associateId") REFERENCES "Associado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transacao" ADD CONSTRAINT "Transacao_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Boleto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transacao" ADD CONSTRAINT "Transacao_associateId_fkey" FOREIGN KEY ("associateId") REFERENCES "Associado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transacao" ADD CONSTRAINT "Transacao_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValorContribuicao" ADD CONSTRAINT "ValorContribuicao_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convencao" ADD CONSTRAINT "Convencao_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnexoConvencao" ADD CONSTRAINT "AnexoConvencao_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "Convencao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnexoConvencao" ADD CONSTRAINT "AnexoConvencao_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Noticia" ADD CONSTRAINT "Noticia_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beneficio" ADD CONSTRAINT "Beneficio_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoCancelamento" ADD CONSTRAINT "SolicitacaoCancelamento_associateId_fkey" FOREIGN KEY ("associateId") REFERENCES "Associado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoCancelamento" ADD CONSTRAINT "SolicitacaoCancelamento_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_associateId_fkey" FOREIGN KEY ("associateId") REFERENCES "Associado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CNPJ is stored as 14 digits so fictional and imported values have one format.
ALTER TABLE "Associado"
ADD CONSTRAINT "Associado_cnpj_formato_check"
CHECK (char_length("cnpj") = 14 AND "cnpj" ~ '^[0-9]{14}$');

CREATE FUNCTION "impedir_alteracao_registro_imutavel"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'A tabela "%" é somente de inclusão; % não é permitido.',
        TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE TRIGGER "Transacao_somente_inclusao"
BEFORE UPDATE OR DELETE ON "Transacao"
FOR EACH ROW EXECUTE FUNCTION "impedir_alteracao_registro_imutavel"();
CREATE TRIGGER "Transacao_sem_truncate"
BEFORE TRUNCATE ON "Transacao"
FOR EACH STATEMENT EXECUTE FUNCTION "impedir_alteracao_registro_imutavel"();

CREATE TRIGGER "ValorContribuicao_somente_inclusao"
BEFORE UPDATE OR DELETE ON "ValorContribuicao"
FOR EACH ROW EXECUTE FUNCTION "impedir_alteracao_registro_imutavel"();
CREATE TRIGGER "ValorContribuicao_sem_truncate"
BEFORE TRUNCATE ON "ValorContribuicao"
FOR EACH STATEMENT EXECUTE FUNCTION "impedir_alteracao_registro_imutavel"();

CREATE TRIGGER "LogAuditoria_somente_inclusao"
BEFORE UPDATE OR DELETE ON "LogAuditoria"
FOR EACH ROW EXECUTE FUNCTION "impedir_alteracao_registro_imutavel"();
CREATE TRIGGER "LogAuditoria_sem_truncate"
BEFORE TRUNCATE ON "LogAuditoria"
FOR EACH STATEMENT EXECUTE FUNCTION "impedir_alteracao_registro_imutavel"();
