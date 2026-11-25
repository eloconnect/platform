import type { Convencao, InscricaoConvencao } from '@eloconnect/shared';
import { formatarCnpj } from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { Link } from 'react-router';
import { api } from '../../api';
import { Botao, Carregando, MensagemErro } from '../../componentes';

type Estado = InscricaoConvencao[] | 'carregando' | 'erro';

/** Farmácias inscritas numa convenção, para a sede (RF23). */
export function JanelaInscritas({
  convencao,
  aoFechar,
}: {
  convencao: Convencao | null;
  aoFechar: () => void;
}) {
  const [estado, setEstado] = useState<Estado>('carregando');

  useEffect(() => {
    if (!convencao) return;
    let ativo = true;
    void api
      .listarInscricoesConvencao(convencao.id)
      .then((lista) => ativo && setEstado(lista))
      .catch(() => ativo && setEstado('erro'));
    return () => {
      ativo = false;
    };
  }, [convencao]);

  return (
    <Modal
      show={convencao !== null}
      onHide={aoFechar}
      centered
      aria-labelledby="titulo-inscritas"
    >
      <Modal.Header closeButton closeLabel="Fechar">
        <Modal.Title as="h2" className="h4" id="titulo-inscritas">
          Farmácias inscritas
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {estado === 'carregando' && <Carregando texto="Carregando..." />}
        {estado === 'erro' && (
          <MensagemErro>
            Não foi possível carregar as inscritas agora. Tente de novo em
            alguns minutos.
          </MensagemErro>
        )}
        {Array.isArray(estado) && estado.length === 0 && (
          <p>Nenhuma farmácia inscrita.</p>
        )}
        {Array.isArray(estado) && estado.length > 0 && (
          <ul className="mb-0">
            {estado.map((inscricao) => (
              <li key={inscricao.associadoId} className="mb-2">
                <Link to={`/admin/associados/${inscricao.associadoId}`}>
                  {inscricao.razaoSocial}
                </Link>{' '}
                (CNPJ {formatarCnpj(inscricao.cnpj)}), em{' '}
                {new Date(inscricao.inscritaEm).toLocaleDateString('pt-BR')}
              </li>
            ))}
          </ul>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Botao variant="outline-secondary" onClick={aoFechar}>
          Fechar
        </Botao>
      </Modal.Footer>
    </Modal>
  );
}
