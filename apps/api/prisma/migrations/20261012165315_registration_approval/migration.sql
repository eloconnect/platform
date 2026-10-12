-- CreateEnum
CREATE TYPE "StatusCadastro" AS ENUM ('PENDING', 'APPROVED');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "registrationApprovedAt" TIMESTAMP(3),
ADD COLUMN     "registrationApprovedByUserId" TEXT,
ADD COLUMN     "registrationRequestedAt" TIMESTAMP(3),
ADD COLUMN     "registrationStatus" "StatusCadastro" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "welcomeEmailSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Usuario_registrationStatus_registrationRequestedAt_idx" ON "Usuario"("registrationStatus", "registrationRequestedAt");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_registrationApprovedByUserId_fkey" FOREIGN KEY ("registrationApprovedByUserId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
