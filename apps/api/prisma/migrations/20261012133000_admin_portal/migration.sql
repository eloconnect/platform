CREATE TYPE "StatusPropostaContribuicao" AS ENUM (
    'PENDING_HOMOLOGATION',
    'APPROVED',
    'REJECTED'
);

CREATE TABLE "PropostaValorContribuicao" (
    "id" TEXT NOT NULL,
    "monthlyAmount" DECIMAL(10,2) NOT NULL,
    "annualAmount" DECIMAL(10,2) NOT NULL,
    "annualDiscountPercent" INTEGER NOT NULL DEFAULT 20,
    "effectiveFrom" DATE NOT NULL,
    "status" "StatusPropostaContribuicao" NOT NULL DEFAULT 'PENDING_HOMOLOGATION',
    "note" TEXT,
    "decisionNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedByUserId" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,

    CONSTRAINT "PropostaValorContribuicao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PropostaValorContribuicao_status_submittedAt_idx"
    ON "PropostaValorContribuicao"("status", "submittedAt");
CREATE INDEX "PropostaValorContribuicao_effectiveFrom_idx"
    ON "PropostaValorContribuicao"("effectiveFrom");

ALTER TABLE "PropostaValorContribuicao"
    ADD CONSTRAINT "PropostaValorContribuicao_submittedByUserId_fkey"
    FOREIGN KEY ("submittedByUserId") REFERENCES "Usuario"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropostaValorContribuicao"
    ADD CONSTRAINT "PropostaValorContribuicao_reviewedByUserId_fkey"
    FOREIGN KEY ("reviewedByUserId") REFERENCES "Usuario"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
