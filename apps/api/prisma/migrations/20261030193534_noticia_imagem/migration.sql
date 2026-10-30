-- Imagem opcional da notícia (RF41), com a descrição para leitor de tela.
-- AlterTable
ALTER TABLE "Noticia" ADD COLUMN     "imagemCaminho" TEXT,
ADD COLUMN     "imagemDescricao" TEXT,
ADD COLUMN     "imagemNome" TEXT;
