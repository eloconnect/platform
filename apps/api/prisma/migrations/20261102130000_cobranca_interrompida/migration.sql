-- Quando a sede interrompeu a cobrança recorrente do associado (RN25).

-- AlterTable
ALTER TABLE "Associado" ADD COLUMN     "cobrancaInterrompidaEm" TIMESTAMP(3);
