-- Cobrança formal (comunicado) a todos os associados, sem boleto, com o
-- envio escalonado pelo limite diário do provedor de e-mail (RN19, RNF09).

-- CreateTable
CREATE TABLE "Comunicado" (
    "id" UUID NOT NULL,
    "assunto" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "criadoPorId" UUID NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "Comunicado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvioComunicado" (
    "id" UUID NOT NULL,
    "comunicadoId" UUID NOT NULL,
    "associadoId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "enviadoEm" TIMESTAMP(3),

    CONSTRAINT "EnvioComunicado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnvioComunicado_enviadoEm_idx" ON "EnvioComunicado"("enviadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "EnvioComunicado_comunicadoId_associadoId_key" ON "EnvioComunicado"("comunicadoId", "associadoId");

-- AddForeignKey
ALTER TABLE "Comunicado" ADD CONSTRAINT "Comunicado_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvioComunicado" ADD CONSTRAINT "EnvioComunicado_comunicadoId_fkey" FOREIGN KEY ("comunicadoId") REFERENCES "Comunicado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvioComunicado" ADD CONSTRAINT "EnvioComunicado_associadoId_fkey" FOREIGN KEY ("associadoId") REFERENCES "Associado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

