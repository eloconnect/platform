-- Pedido de suporte do associado em dia (RF25), que a sede marca como
-- respondido.

-- CreateTable
CREATE TABLE "PedidoSuporte" (
    "id" UUID NOT NULL,
    "associadoId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "assunto" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidoEm" TIMESTAMP(3),
    "respondidoPorId" UUID,

    CONSTRAINT "PedidoSuporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PedidoSuporte_respondidoEm_criadoEm_idx" ON "PedidoSuporte"("respondidoEm", "criadoEm");

-- CreateIndex
CREATE INDEX "PedidoSuporte_associadoId_idx" ON "PedidoSuporte"("associadoId");

-- AddForeignKey
ALTER TABLE "PedidoSuporte" ADD CONSTRAINT "PedidoSuporte_associadoId_fkey" FOREIGN KEY ("associadoId") REFERENCES "Associado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoSuporte" ADD CONSTRAINT "PedidoSuporte_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoSuporte" ADD CONSTRAINT "PedidoSuporte_respondidoPorId_fkey" FOREIGN KEY ("respondidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

