-- CreateEnum
CREATE TYPE "GrupoBeneficio" AS ENUM ('ASSESSORIA_JURIDICA', 'CONSULTORIA');

-- AlterTable
-- Os benefícios que já existem (só os fictícios do seed) entram como
-- consultoria; depois, o grupo passa a ser obrigatório em cada cadastro.
ALTER TABLE "Beneficio" ADD COLUMN "grupo" "GrupoBeneficio" NOT NULL DEFAULT 'CONSULTORIA';
ALTER TABLE "Beneficio" ALTER COLUMN "grupo" DROP DEFAULT;
