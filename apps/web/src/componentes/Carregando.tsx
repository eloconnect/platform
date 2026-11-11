/**
 * Enquanto carrega: blocos cinza no formato do conteúdo, para a tela não
 * pular quando os dados chegam. O texto fica para o leitor de tela.
 */
export function Carregando({ texto }: { texto: string }) {
  return (
    <div role="status" className="elo-carregando">
      <span className="visually-hidden">{texto}</span>
      <div className="elo-esqueleto" aria-hidden="true" />
      <div className="elo-esqueleto elo-esqueleto--curto" aria-hidden="true" />
    </div>
  );
}
