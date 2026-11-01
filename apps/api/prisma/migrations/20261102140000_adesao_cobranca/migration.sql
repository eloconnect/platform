-- Adesão à cobrança recorrente pelo associado, com o aceite do termo (RN23).

-- CreateTable
CREATE TABLE "AdesaoCobranca" (
    "id" UUID NOT NULL,
    "associadoId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "versaoTermo" TEXT NOT NULL,
    "aceitaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdesaoCobranca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdesaoCobranca_associadoId_aceitaEm_idx" ON "AdesaoCobranca"("associadoId", "aceitaEm");

-- AddForeignKey
ALTER TABLE "AdesaoCobranca" ADD CONSTRAINT "AdesaoCobranca_associadoId_fkey" FOREIGN KEY ("associadoId") REFERENCES "Associado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdesaoCobranca" ADD CONSTRAINT "AdesaoCobranca_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- O aceite do termo é prova: a tabela só aceita inclusão, como as da migration init.
CREATE TRIGGER "AdesaoCobranca_imutavel"
  BEFORE UPDATE OR DELETE ON "AdesaoCobranca"
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();
CREATE TRIGGER "AdesaoCobranca_sem_truncate"
  BEFORE TRUNCATE ON "AdesaoCobranca"
  FOR EACH STATEMENT EXECUTE FUNCTION bloquear_alteracao();
