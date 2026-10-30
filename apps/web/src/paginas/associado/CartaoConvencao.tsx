import type { ReactNode } from 'react';
import Card from 'react-bootstrap/Card';

/**
 * Uma convenção como o associado vê (RF22): o título, o ano e o resumo em
 * destaque. A sede usa o mesmo cartão na pré-visualização.
 */
export function CartaoConvencao({
  titulo,
  ano,
  resumo,
  nivelTitulo = 'h2',
  children,
}: {
  titulo: string;
  ano: number;
  resumo: string;
  nivelTitulo?: 'h2' | 'h3';
  /** O botão do PDF. */
  children?: ReactNode;
}) {
  return (
    <Card as="article" className="mb-4">
      <Card.Body>
        <Card.Title as={nivelTitulo} className="h4">
          {titulo}
        </Card.Title>
        <Card.Text className="text-body-secondary">Ano: {ano}</Card.Text>
        <Card.Text className="texto-com-quebras fs-5">{resumo}</Card.Text>
        {children}
      </Card.Body>
    </Card>
  );
}
