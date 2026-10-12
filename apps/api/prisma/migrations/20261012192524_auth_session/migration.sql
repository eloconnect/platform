-- CreateTable
CREATE TABLE "SessaoAutenticacao" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessaoAutenticacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessaoAutenticacao_tokenHash_key" ON "SessaoAutenticacao"("tokenHash");

-- CreateIndex
CREATE INDEX "SessaoAutenticacao_usuarioId_expiraEm_idx" ON "SessaoAutenticacao"("usuarioId", "expiraEm");

-- AddForeignKey
ALTER TABLE "SessaoAutenticacao" ADD CONSTRAINT "SessaoAutenticacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
