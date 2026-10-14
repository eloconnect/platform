import PDFKit from 'pdfkit';

interface BoletoRelatorio {
  competencia: Date;
  vencimento: Date;
  valor: { toString(): string } | number;
  status: string;
  pagoEm: Date | null;
}

interface AssociadoHistorico {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  municipio: string | null;
  email: string | null;
  telefone: string | null;
  situacao: string;
  boletos: BoletoRelatorio[];
}

interface AssociadoLista {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  municipio: string | null;
  situacao: string;
}

type DocumentoPdf = InstanceType<typeof PDFKit>;

function gerarPdf(montar: (doc: DocumentoPdf) => void): Promise<Buffer> {
  const doc = new PDFKit({ size: 'A4', margin: 48 });
  const partes: Buffer[] = [];
  return new Promise((resolve, reject) => {
    doc.on('data', (parte: Buffer) => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
    montar(doc);
    doc.end();
  });
}

function dataPtBr(valor: Date | null) {
  return valor ? valor.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
}

function moedaPtBr(valor: number | { toString(): string }) {
  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function cnpjFormatado(cnpj: string) {
  return cnpj.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5',
  );
}

function rotuloSituacao(situacao: string) {
  if (situacao === 'EM_DIA' || situacao === 'ADIMPLENTE') return 'Adimplente';
  return situacao === 'PENDENTE' ? 'Pendente' : 'Inadimplente';
}

export function pdfHistoricoAssociado(associado: AssociadoHistorico) {
  return gerarPdf((doc) => {
    doc.fontSize(18).font('Helvetica-Bold').text('Elo Connect', {
      align: 'center',
    });
    doc.moveDown(0.3);
    doc.fontSize(14).text('Histórico financeiro do associado', {
      align: 'center',
    });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica');
    doc.text(`Emitido em: ${dataPtBr(new Date())}`);
    doc.text(`Razão social: ${associado.razaoSocial}`);
    doc.text(`Nome fantasia: ${associado.nomeFantasia ?? '—'}`);
    doc.text(`CNPJ: ${cnpjFormatado(associado.cnpj)}`);
    doc.text(`Município: ${associado.municipio ?? '—'} / MT`);
    doc.text(`E-mail: ${associado.email ?? '—'}`);
    doc.text(`Telefone: ${associado.telefone ?? '—'}`);
    doc.text(`Situação atual: ${rotuloSituacao(associado.situacao)}`);
    doc.moveDown();
    doc.font('Helvetica-Bold').text('Boletos e pagamentos registrados');
    doc.moveDown(0.4);

    if (associado.boletos.length === 0) {
      doc.font('Helvetica').text('Nenhum lançamento financeiro registrado.');
    } else {
      const totalPago = associado.boletos
        .filter((boleto) => boleto.status === 'PAGO')
        .reduce((total, boleto) => total + Number(boleto.valor), 0);
      doc.font('Helvetica').text(`Lançamentos: ${associado.boletos.length}`);
      doc.text(`Total pago: ${moedaPtBr(totalPago)}`);
      doc.moveDown(0.5);

      for (const boleto of associado.boletos) {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 70) {
          doc.addPage();
          doc
            .font('Helvetica-Bold')
            .text(
              `Histórico financeiro (continuação) — ${associado.razaoSocial} — CNPJ ${cnpjFormatado(associado.cnpj)}`,
            );
          doc.moveDown(0.5);
        }
        const status =
          boleto.status === 'PAGO'
            ? `Pago em ${dataPtBr(boleto.pagoEm)}`
            : boleto.status.replaceAll('_', ' ').toLowerCase();
        doc
          .font('Helvetica-Bold')
          .text(`Competência: ${dataPtBr(boleto.competencia)}`);
        doc
          .font('Helvetica')
          .text(
            `Vencimento: ${dataPtBr(boleto.vencimento)} | Valor: ${moedaPtBr(boleto.valor)} | Situação: ${status}`,
          );
        doc.moveDown(0.45);
      }
    }
    doc.moveDown();
    doc
      .fontSize(8)
      .fillColor('#555555')
      .text('Documento emitido pela administração do Elo Connect.');
  });
}

export function pdfListaAssociados(associados: AssociadoLista[]) {
  return gerarPdf((doc) => {
    const cabecalho = () => {
      doc.fontSize(16).font('Helvetica-Bold').text('Elo Connect');
      doc.fontSize(13).text('Base estadual de farmácias associadas');
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(
          `Emitido em: ${dataPtBr(new Date())} | Total: ${associados.length}`,
        );
      doc.moveDown(0.6);
    };
    cabecalho();

    for (const [indice, associado] of associados.entries()) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 65) {
        doc.addPage();
        cabecalho();
      }
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(
          `${indice + 1}. ${associado.nomeFantasia ?? associado.razaoSocial}`,
        );
      doc
        .font('Helvetica')
        .text(
          `Razão social: ${associado.razaoSocial} | CNPJ: ${cnpjFormatado(associado.cnpj)} | Município: ${associado.municipio ?? '—'} / MT | Situação: ${rotuloSituacao(associado.situacao)}`,
        );
      doc.moveDown(0.4);
    }
  });
}
