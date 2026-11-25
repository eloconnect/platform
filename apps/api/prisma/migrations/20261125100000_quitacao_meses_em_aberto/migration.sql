-- Boleto único dos meses em aberto (RN30, RF37): o associado pede, o chave
-- mestre aprova ou recusa, e os boletos expirados apontam para o boleto que
-- os junta.

-- CreateEnum
CREATE TYPE "StatusPedidoQuitacao" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO');

-- AlterEnum
ALTER TYPE "TipoBoleto" ADD VALUE 'QUITACAO';

-- AlterTable
ALTER TABLE "Boleto" ADD COLUMN     "quitadoPorId" UUID;

-- CreateTable
CREATE TABLE "PedidoQuitacao" (
    "id" UUID NOT NULL,
    "associadoId" UUID NOT NULL,
    "status" "StatusPedidoQuitacao" NOT NULL DEFAULT 'PENDENTE',
    "solicitadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decididoEm" TIMESTAMP(3),
    "decididoPorId" UUID,
    "observacaoSede" TEXT,
    "boletoId" UUID,

    CONSTRAINT "PedidoQuitacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PedidoQuitacao_boletoId_key" ON "PedidoQuitacao"("boletoId");

-- CreateIndex
CREATE INDEX "PedidoQuitacao_associadoId_status_idx" ON "PedidoQuitacao"("associadoId", "status");

-- CreateIndex
CREATE INDEX "PedidoQuitacao_status_idx" ON "PedidoQuitacao"("status");

-- AddForeignKey
ALTER TABLE "Boleto" ADD CONSTRAINT "Boleto_quitadoPorId_fkey" FOREIGN KEY ("quitadoPorId") REFERENCES "Boleto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoQuitacao" ADD CONSTRAINT "PedidoQuitacao_associadoId_fkey" FOREIGN KEY ("associadoId") REFERENCES "Associado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoQuitacao" ADD CONSTRAINT "PedidoQuitacao_decididoPorId_fkey" FOREIGN KEY ("decididoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoQuitacao" ADD CONSTRAINT "PedidoQuitacao_boletoId_fkey" FOREIGN KEY ("boletoId") REFERENCES "Boleto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

