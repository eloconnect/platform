-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('ADMIN', 'ASSOCIADO');

-- CreateEnum
CREATE TYPE "TipoToken" AS ENUM ('RECUPERACAO_SENHA', 'CONFIRMACAO_EMAIL');

-- CreateEnum
CREATE TYPE "SituacaoAssociado" AS ENUM ('ADIMPLENTE', 'INADIMPLENTE');

-- CreateEnum
CREATE TYPE "AcessoManual" AS ENUM ('LIBERADO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "StatusCancelamento" AS ENUM ('PENDENTE', 'APROVADA', 'RECUSADA');

-- CreateEnum
CREATE TYPE "StatusLote" AS ENUM ('RASCUNHO', 'ENVIADO');

-- CreateEnum
CREATE TYPE "TipoBoleto" AS ENUM ('MENSAL', 'AVULSO', 'ANUAL');

-- CreateEnum
CREATE TYPE "StatusBoleto" AS ENUM ('RASCUNHO', 'EM_ABERTO', 'PAGO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EventoTransacao" AS ENUM ('GERADO', 'EDITADO', 'EMITIDO', 'PAGO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('BOLETO', 'PIX');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "emailConfirmadoEm" TIMESTAMP(3),
    "associadoId" UUID,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenUsuario" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "tipo" "TipoToken" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Associado" (
    "id" UUID NOT NULL,
    "cnpj" CHAR(14) NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "municipio" TEXT,
    "contribuicaoAtiva" BOOLEAN NOT NULL DEFAULT false,
    "situacao" "SituacaoAssociado" NOT NULL DEFAULT 'INADIMPLENTE',
    "acessoManual" "AcessoManual",
    "inativadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Associado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitacaoCancelamento" (
    "id" UUID NOT NULL,
    "associadoId" UUID NOT NULL,
    "status" "StatusCancelamento" NOT NULL DEFAULT 'PENDENTE',
    "motivo" TEXT,
    "observacaoSede" TEXT,
    "solicitadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decididaEm" TIMESTAMP(3),
    "decididaPorId" UUID,

    CONSTRAINT "SolicitacaoCancelamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValorContribuicao" (
    "id" UUID NOT NULL,
    "valorMensal" DECIMAL(10,2) NOT NULL,
    "valorAnual" DECIMAL(10,2) NOT NULL,
    "alteradoPorId" UUID NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValorContribuicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoteMensal" (
    "id" UUID NOT NULL,
    "competencia" DATE NOT NULL,
    "status" "StatusLote" NOT NULL DEFAULT 'RASCUNHO',
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEm" TIMESTAMP(3),
    "enviadoPorId" UUID,

    CONSTRAINT "LoteMensal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boleto" (
    "id" UUID NOT NULL,
    "associadoId" UUID NOT NULL,
    "loteId" UUID,
    "tipo" "TipoBoleto" NOT NULL,
    "competencia" DATE NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "vencimento" DATE NOT NULL,
    "status" "StatusBoleto" NOT NULL DEFAULT 'RASCUNHO',
    "sicrediNossoNumero" TEXT,
    "linhaDigitavel" TEXT,
    "pixCopiaECola" TEXT,
    "emitidoEm" TIMESTAMP(3),
    "pagoEm" TIMESTAMP(3),
    "ultimoLembreteEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Boleto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transacao" (
    "id" UUID NOT NULL,
    "boletoId" UUID NOT NULL,
    "associadoId" UUID NOT NULL,
    "evento" "EventoTransacao" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "sicrediNossoNumero" TEXT,
    "formaPagamento" "FormaPagamento",
    "usuarioId" UUID,
    "detalhes" JSONB,
    "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "associadoId" UUID,
    "valorAnterior" JSONB,
    "valorNovo" JSONB,
    "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Convencao" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "resumo" TEXT NOT NULL,
    "tabelaReajuste" JSONB,
    "publicadaEm" TIMESTAMP(3),
    "autorId" UUID NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Convencao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConvencaoAnexo" (
    "id" UUID NOT NULL,
    "convencaoId" UUID NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "arquivoUrl" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConvencaoAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Noticia" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "publicadaEm" TIMESTAMP(3),
    "removidaEm" TIMESTAMP(3),
    "autorId" UUID NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Noticia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beneficio" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beneficio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_associadoId_key" ON "Usuario"("associadoId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenUsuario_tokenHash_key" ON "TokenUsuario"("tokenHash");

-- CreateIndex
CREATE INDEX "TokenUsuario_usuarioId_idx" ON "TokenUsuario"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Associado_cnpj_key" ON "Associado"("cnpj");

-- CreateIndex
CREATE INDEX "Associado_situacao_idx" ON "Associado"("situacao");

-- CreateIndex
CREATE INDEX "Associado_contribuicaoAtiva_idx" ON "Associado"("contribuicaoAtiva");

-- CreateIndex
CREATE INDEX "SolicitacaoCancelamento_associadoId_status_idx" ON "SolicitacaoCancelamento"("associadoId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LoteMensal_competencia_key" ON "LoteMensal"("competencia");

-- CreateIndex
CREATE UNIQUE INDEX "Boleto_sicrediNossoNumero_key" ON "Boleto"("sicrediNossoNumero");

-- CreateIndex
CREATE INDEX "Boleto_associadoId_competencia_idx" ON "Boleto"("associadoId", "competencia");

-- CreateIndex
CREATE INDEX "Boleto_status_vencimento_idx" ON "Boleto"("status", "vencimento");

-- CreateIndex
CREATE INDEX "Transacao_associadoId_ocorridoEm_idx" ON "Transacao"("associadoId", "ocorridoEm");

-- CreateIndex
CREATE INDEX "Transacao_boletoId_idx" ON "Transacao"("boletoId");

-- CreateIndex
CREATE INDEX "LogAuditoria_usuarioId_ocorridoEm_idx" ON "LogAuditoria"("usuarioId", "ocorridoEm");

-- CreateIndex
CREATE INDEX "LogAuditoria_associadoId_ocorridoEm_idx" ON "LogAuditoria"("associadoId", "ocorridoEm");

-- CreateIndex
CREATE INDEX "LogAuditoria_acao_ocorridoEm_idx" ON "LogAuditoria"("acao", "ocorridoEm");

-- CreateIndex
CREATE INDEX "Convencao_ano_idx" ON "Convencao"("ano");

-- CreateIndex
CREATE INDEX "ConvencaoAnexo_convencaoId_idx" ON "ConvencaoAnexo"("convencaoId");

-- CreateIndex
CREATE INDEX "Noticia_publicadaEm_idx" ON "Noticia"("publicadaEm");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_associadoId_fkey" FOREIGN KEY ("associadoId") REFERENCES "Associado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenUsuario" ADD CONSTRAINT "TokenUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoCancelamento" ADD CONSTRAINT "SolicitacaoCancelamento_associadoId_fkey" FOREIGN KEY ("associadoId") REFERENCES "Associado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoCancelamento" ADD CONSTRAINT "SolicitacaoCancelamento_decididaPorId_fkey" FOREIGN KEY ("decididaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValorContribuicao" ADD CONSTRAINT "ValorContribuicao_alteradoPorId_fkey" FOREIGN KEY ("alteradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteMensal" ADD CONSTRAINT "LoteMensal_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boleto" ADD CONSTRAINT "Boleto_associadoId_fkey" FOREIGN KEY ("associadoId") REFERENCES "Associado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boleto" ADD CONSTRAINT "Boleto_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "LoteMensal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transacao" ADD CONSTRAINT "Transacao_boletoId_fkey" FOREIGN KEY ("boletoId") REFERENCES "Boleto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transacao" ADD CONSTRAINT "Transacao_associadoId_fkey" FOREIGN KEY ("associadoId") REFERENCES "Associado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transacao" ADD CONSTRAINT "Transacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_associadoId_fkey" FOREIGN KEY ("associadoId") REFERENCES "Associado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convencao" ADD CONSTRAINT "Convencao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvencaoAnexo" ADD CONSTRAINT "ConvencaoAnexo_convencaoId_fkey" FOREIGN KEY ("convencaoId") REFERENCES "Convencao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Noticia" ADD CONSTRAINT "Noticia_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Tabelas imutáveis (RN16, RN17, RN26, RNF06)
-- Histórico de valores, transações e log de auditoria aceitam só INSERT.
-- UPDATE, DELETE e TRUNCATE são recusados pelo próprio banco.
-- ---------------------------------------------------------------------------

CREATE FUNCTION bloquear_alteracao() RETURNS trigger AS $$
BEGIN
  -- Sem ERRCODE próprio: o padrão (P0001) faz o Prisma repassar esta mensagem.
  -- Um código da classe 23 seria traduzido como "Foreign key constraint violated".
  RAISE EXCEPTION 'A tabela "%" é imutável: só aceita inclusão de registros.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ValorContribuicao_imutavel"
  BEFORE UPDATE OR DELETE ON "ValorContribuicao"
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();
CREATE TRIGGER "ValorContribuicao_sem_truncate"
  BEFORE TRUNCATE ON "ValorContribuicao"
  FOR EACH STATEMENT EXECUTE FUNCTION bloquear_alteracao();

CREATE TRIGGER "Transacao_imutavel"
  BEFORE UPDATE OR DELETE ON "Transacao"
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();
CREATE TRIGGER "Transacao_sem_truncate"
  BEFORE TRUNCATE ON "Transacao"
  FOR EACH STATEMENT EXECUTE FUNCTION bloquear_alteracao();

CREATE TRIGGER "LogAuditoria_imutavel"
  BEFORE UPDATE OR DELETE ON "LogAuditoria"
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();
CREATE TRIGGER "LogAuditoria_sem_truncate"
  BEFORE TRUNCATE ON "LogAuditoria"
  FOR EACH STATEMENT EXECUTE FUNCTION bloquear_alteracao();
