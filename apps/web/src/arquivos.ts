/**
 * Abre o arquivo baixado da API (ex.: um PDF) numa aba nova. Se o navegador
 * bloquear a aba, baixa o arquivo com o nome dado.
 */
export function abrirArquivo(arquivo: Blob, nome: string) {
  const endereco = URL.createObjectURL(arquivo);

  if (!window.open(endereco, '_blank')) {
    salvar(endereco, nome);
  }

  liberarDepois(endereco);
}

/**
 * Baixa o arquivo da API com o nome dado, sem abrir aba (ex.: um comprovante
 * para mandar por e-mail ou uma planilha).
 */
export function baixarArquivo(arquivo: Blob, nome: string) {
  const endereco = URL.createObjectURL(arquivo);
  salvar(endereco, nome);
  liberarDepois(endereco);
}

function salvar(endereco: string, nome: string) {
  const link = document.createElement('a');
  link.href = endereco;
  link.download = nome;
  link.click();
}

/** Tempo para a aba nova carregar o arquivo antes de liberar a memória. */
function liberarDepois(endereco: string) {
  setTimeout(() => URL.revokeObjectURL(endereco), 60_000);
}
