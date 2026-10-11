import { useId, type InputHTMLAttributes } from 'react';
import Form from 'react-bootstrap/Form';

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'size' | 'id' | 'value'
> & {
  value?: string | number;
  /** Texto do rótulo, sempre visível (RNF02). */
  rotulo: string;
  /** Explicação curta abaixo do campo. */
  ajuda?: string;
  /** Mensagem de erro em português simples. Marca o campo como inválido. */
  erro?: string;
  /** Mostra "(obrigatório)" no rótulo e marca o campo como obrigatório. */
  obrigatorio?: boolean;
  id?: string;
};

/**
 * Campo de formulário com rótulo visível, ajuda e erro ligados ao campo
 * para leitores de tela (aria-describedby).
 */
export function CampoTexto({
  rotulo,
  ajuda,
  erro,
  obrigatorio = false,
  id,
  ...props
}: Props) {
  const idGerado = useId();
  const idCampo = id ?? idGerado;
  const idAjuda = ajuda ? `${idCampo}-ajuda` : undefined;
  const idErro = erro ? `${idCampo}-erro` : undefined;
  const descritoPor = [idAjuda, idErro].filter(Boolean).join(' ') || undefined;

  return (
    <Form.Group className="mb-4" controlId={idCampo}>
      <Form.Label>
        {rotulo}
        {obrigatorio && (
          <span className="text-body-secondary"> (obrigatório)</span>
        )}
      </Form.Label>
      <Form.Control
        size="lg"
        required={obrigatorio}
        isInvalid={Boolean(erro)}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descritoPor}
        {...props}
      />
      {ajuda && <Form.Text id={idAjuda}>{ajuda}</Form.Text>}
      {erro && (
        <Form.Control.Feedback id={idErro} type="invalid">
          {erro}
        </Form.Control.Feedback>
      )}
    </Form.Group>
  );
}
