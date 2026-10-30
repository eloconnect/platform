-- CreateEnum
CREATE TYPE "TipoAnexoConvencao" AS ENUM ('INTEGRAL', 'RESUMIDA');

-- Add the column as nullable to support existing attachments.
ALTER TABLE "ConvencaoAnexo"
ADD COLUMN "tipo" "TipoAnexoConvencao";

-- Existing attachments have no recorded type.
-- Classify them as INTEGRAL as a migration fallback.
UPDATE "ConvencaoAnexo"
SET "tipo" = 'INTEGRAL'
WHERE "tipo" IS NULL;

-- Make the column required after backfilling existing rows.
ALTER TABLE "ConvencaoAnexo"
ALTER COLUMN "tipo" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ConvencaoAnexo_convencaoId_tipo_idx"
ON "ConvencaoAnexo"("convencaoId", "tipo");
