import qrcodeGenerator from 'qrcode-generator';

/**
 * QR Code do Pix (RN06). Ele guarda o mesmo texto do Pix Copia e Cola, com
 * correção de erro média.
 */
export function qrCodePix(pixCopiaECola: string) {
  const qr = qrcodeGenerator(0, 'M');
  qr.addData(pixCopiaECola);
  qr.make();
  return qr;
}
