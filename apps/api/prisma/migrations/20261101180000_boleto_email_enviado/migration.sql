-- Quando o e-mail com o boleto saiu para o associado (RF12).

-- AlterTable
ALTER TABLE "Boleto" ADD COLUMN     "emailEnviadoEm" TIMESTAMP(3);
