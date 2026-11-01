-- O lote sai sozinho, sem revisão da sede (P20): ninguém mais envia o lote.

-- DropForeignKey
ALTER TABLE "LoteMensal" DROP CONSTRAINT "LoteMensal_enviadoPorId_fkey";

-- AlterTable
ALTER TABLE "LoteMensal" DROP COLUMN "enviadoPorId";
