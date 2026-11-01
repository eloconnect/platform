import type { BoletoEmAberto } from '@eloconnect/shared';
import {
  formatarDia,
  formatarReais,
  textoCompetencia,
} from '@eloconnect/shared';
import qrcodeGenerator from 'qrcode-generator';
import { useEffect, useMemo, useState } from 'react';
import Card from 'react-bootstrap/Card';
import { useLocation } from 'react-router';
import { api } from '../../api';
import { abrirArquivo } from '../../arquivos';
import {
  AvisoSucesso,
  Botao,
  lerAviso,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'ok'; boletos: BoletoEmAberto[] };

/**
 * Boletos em aberto do associado (US12: RF12, RN06): o valor e o vencimento
 * em destaque, o QR Code do Pix, os botões de copiar o código Pix e a linha
 * digitável e o PDF do boleto.
 */
export function PaginaBoletosAssociado() {
  useTituloPagina('Meus boletos');
  // Aviso da adesão, que traz o associado para cá (RN23).
  const aviso = lerAviso(useLocation().state);
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });

  useEffect(() => {
    let ativo = true;
    void api
      .listarMeusBoletos()
      .then((boletos) => ativo && setEstado({ tipo: 'ok', boletos }))
      .catch(() => ativo && setEstado({ tipo: 'erro' }));
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <>
      <h1>Meus boletos</h1>
      {aviso && <AvisoSucesso>{aviso}</AvisoSucesso>}
      {estado.tipo === 'carregando' && (
        <p role="status">Carregando os boletos...</p>
      )}
      {estado.tipo === 'erro' && (
        <MensagemErro>
          Não foi possível carregar os boletos agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}
      {estado.tipo === 'ok' && estado.boletos.length === 0 && (
        <p>Você não tem boleto em aberto.</p>
      )}
      {estado.tipo === 'ok' &&
        estado.boletos.map((boleto) => (
          <CartaoBoleto key={boleto.id} boleto={boleto} />
        ))}
    </>
  );
}

function CartaoBoleto({ boleto }: { boleto: BoletoEmAberto }) {
  const mes = textoCompetencia(boleto.competencia);
  const qrCode = useMemo(
    () => imagemQrCode(boleto.pixCopiaECola),
    [boleto.pixCopiaECola],
  );
  const [aviso, setAviso] = useState('');
  const [erroCopia, setErroCopia] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [erroPdf, setErroPdf] = useState(false);

  async function copiar(texto: string, avisoCopiado: string) {
    setAviso('');
    setErroCopia(false);
    try {
      await navigator.clipboard.writeText(texto);
      setAviso(avisoCopiado);
    } catch {
      setErroCopia(true);
    }
  }

  async function baixarPdf() {
    setBaixando(true);
    setErroPdf(false);
    try {
      abrirArquivo(
        await api.baixarPdfMeuBoleto(boleto.id),
        `boleto-${boleto.competencia.ano}-${String(boleto.competencia.mes).padStart(2, '0')}.pdf`,
      );
    } catch {
      setErroPdf(true);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Card as="article" className="mb-4">
      <Card.Body>
        <Card.Title as="h2" className="h3">
          Boleto de {mes}
        </Card.Title>
        <p className="fs-3 mb-1">
          <strong>Valor: {formatarReais(boleto.valor)}</strong>
        </p>
        <p className="fs-3">
          <strong>Vencimento: {formatarDia(boleto.vencimento)}</strong>
        </p>
        <p>
          {boleto.vencido
            ? `Situação: vencido. Você ainda pode pagar até ${formatarDia(boleto.validoAte)}. Depois disso, o acesso a benefícios e suporte fica bloqueado até o pagamento.`
            : 'Situação: em aberto.'}
        </p>

        <h3 className="h4 mt-4">Pagar com Pix</h3>
        <p>
          No aplicativo do seu banco, escolha pagar com Pix e leia o QR Code. Se
          preferir, copie o código e use a opção Pix Copia e Cola.
        </p>
        <img
          src={qrCode}
          alt="QR Code do Pix"
          width={280}
          height={280}
          className="d-block mb-3 img-fluid"
        />
        <p className="font-monospace text-break">{boleto.pixCopiaECola}</p>
        <Botao
          onClick={() =>
            void copiar(boleto.pixCopiaECola, 'Código Pix copiado.')
          }
        >
          Copiar o código Pix
        </Botao>

        <h3 className="h4 mt-4">Pagar com o boleto</h3>
        <p className="mb-1">Linha digitável:</p>
        <p className="font-monospace text-break">{boleto.linhaDigitavel}</p>
        <div className="d-flex flex-wrap gap-3">
          <Botao
            variant="outline-primary"
            onClick={() =>
              void copiar(boleto.linhaDigitavel, 'Linha digitável copiada.')
            }
          >
            Copiar a linha digitável
          </Botao>
          <Botao
            variant="outline-primary"
            disabled={baixando}
            onClick={() => void baixarPdf()}
          >
            Baixar o PDF do boleto
          </Botao>
        </div>

        <p role="status" className="mt-3 mb-0 fw-bold">
          {aviso}
        </p>
        {erroCopia && (
          <MensagemErro>
            Não foi possível copiar. Selecione o código na tela e copie.
          </MensagemErro>
        )}
        {erroPdf && (
          <MensagemErro>
            Não foi possível baixar o PDF agora. Tente de novo em alguns
            minutos.
          </MensagemErro>
        )}
      </Card.Body>
    </Card>
  );
}

/** QR Code do Pix em SVG: guarda o mesmo texto do Pix Copia e Cola (RN06). */
function imagemQrCode(pixCopiaECola: string): string {
  const qr = qrcodeGenerator(0, 'M');
  qr.addData(pixCopiaECola);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
