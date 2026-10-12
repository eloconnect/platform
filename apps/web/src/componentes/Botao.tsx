import Button, { type ButtonProps } from 'react-bootstrap/Button';

/**
 * Botão padrão do sistema: grande por padrão (RNF01).
 * Use sempre um texto claro, nunca só um ícone.
 */
export function Botao({ size = 'lg', ...props }: ButtonProps) {
  return <Button size={size} {...props} />;
}
