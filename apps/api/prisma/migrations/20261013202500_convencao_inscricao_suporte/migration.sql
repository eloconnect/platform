CREATE TYPE "StatusSolicitacaoSuporte" AS ENUM ('RECEBIDA', 'EM_ANALISE', 'CONCLUIDA');

CREATE TABLE "InscricaoConvencao" (
    "id" UUID NOT NULL,
    "associadoId" UUID NOT NULL,
    "convencaoId" UUID NOT NULL,
    "inscritaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InscricaoConvencao_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SolicitacaoSuporte" (
    "id" UUID NOT NULL,
    "associadoId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "mensagem" TEXT NOT NULL,
    "status" "StatusSolicitacaoSuporte" NOT NULL DEFAULT 'RECEBIDA',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitacaoSuporte_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InscricaoConvencao_associadoId_convencaoId_key"
ON "InscricaoConvencao"("associadoId", "convencaoId");

CREATE INDEX "InscricaoConvencao_convencaoId_inscritaEm_idx"
ON "InscricaoConvencao"("convencaoId", "inscritaEm");

CREATE INDEX "SolicitacaoSuporte_status_criadaEm_idx"
ON "SolicitacaoSuporte"("status", "criadaEm");

CREATE INDEX "SolicitacaoSuporte_associadoId_criadaEm_idx"
ON "SolicitacaoSuporte"("associadoId", "criadaEm");

ALTER TABLE "InscricaoConvencao"
ADD CONSTRAINT "InscricaoConvencao_associadoId_fkey"
FOREIGN KEY ("associadoId") REFERENCES "Associado"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InscricaoConvencao"
ADD CONSTRAINT "InscricaoConvencao_convencaoId_fkey"
FOREIGN KEY ("convencaoId") REFERENCES "Convencao"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SolicitacaoSuporte"
ADD CONSTRAINT "SolicitacaoSuporte_associadoId_fkey"
FOREIGN KEY ("associadoId") REFERENCES "Associado"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SolicitacaoSuporte"
ADD CONSTRAINT "SolicitacaoSuporte_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
