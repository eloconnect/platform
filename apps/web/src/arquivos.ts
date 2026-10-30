/**
 * Abre o arquivo baixado da API (ex.: um PDF) numa aba nova. Se o navegador
 * bloquear a aba, baixa o arquivo com o nome dado.
 */
export function abrirArquivo(arquivo: Blob, nome: string) {
  const endereco = URL.createObjectURL(arquivo);

  if (!window.open(endereco, '_blank')) {
    const link = document.createElement('a');
    link.href = endereco;
    link.download = nome;
    link.click();
  }

  // Tempo para a aba nova carregar o arquivo antes de liberar a memória.
  setTimeout(() => URL.revokeObjectURL(endereco), 60_000);
}
