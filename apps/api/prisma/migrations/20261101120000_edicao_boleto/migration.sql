-- Valor do boleto do mês seguinte mudado pela sede (RN04, RF11).

-- CreateTable
CREATE TABLE "EdicaoBoleto" (
    "id" UUID NOT NULL,
    "associadoId" UUID NOT NULL,
    "competencia" DATE NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EdicaoBoleto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EdicaoBoleto_associadoId_competencia_key" ON "EdicaoBoleto"("associadoId", "competencia");

-- AddForeignKey
ALTER TABLE "EdicaoBoleto" ADD CONSTRAINT "EdicaoBoleto_associadoId_fkey" FOREIGN KEY ("associadoId") REFERENCES "Associado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

