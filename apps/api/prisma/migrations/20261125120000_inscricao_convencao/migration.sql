-- Inscrição da farmácia em dia numa convenção, com comprovante (RF23, P05).

-- CreateTable
CREATE TABLE "InscricaoConvencao" (
    "id" UUID NOT NULL,
    "convencaoId" UUID NOT NULL,
    "associadoId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "inscritaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InscricaoConvencao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InscricaoConvencao_associadoId_idx" ON "InscricaoConvencao"("associadoId");

-- CreateIndex
CREATE UNIQUE INDEX "InscricaoConvencao_convencaoId_associadoId_key" ON "InscricaoConvencao"("convencaoId", "associadoId");

-- AddForeignKey
ALTER TABLE "InscricaoConvencao" ADD CONSTRAINT "InscricaoConvencao_convencaoId_fkey" FOREIGN KEY ("convencaoId") REFERENCES "Convencao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscricaoConvencao" ADD CONSTRAINT "InscricaoConvencao_associadoId_fkey" FOREIGN KEY ("associadoId") REFERENCES "Associado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscricaoConvencao" ADD CONSTRAINT "InscricaoConvencao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

