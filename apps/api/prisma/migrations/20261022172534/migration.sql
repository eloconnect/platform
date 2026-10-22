-- CreateTable
CREATE TABLE "ConfiguracaoPaginaInicial" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "titulo" TEXT NOT NULL DEFAULT 'Informações do sindicato para farmácias associadas',
    "descricao" TEXT NOT NULL DEFAULT 'Acesse informações sobre benefícios, convenções coletivas e suporte. Entre no portal para consultar os serviços disponíveis.',
    "imagemUrl" TEXT,
    "imagemAlt" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoPaginaInicial_pkey" PRIMARY KEY ("id")
);
