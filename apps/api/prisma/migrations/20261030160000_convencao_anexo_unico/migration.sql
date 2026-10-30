-- Um PDF de cada tipo (integral e resumido) por convenção.
DROP INDEX "ConvencaoAnexo_convencaoId_tipo_idx";

CREATE UNIQUE INDEX "ConvencaoAnexo_convencaoId_tipo_key" ON "ConvencaoAnexo"("convencaoId", "tipo");
