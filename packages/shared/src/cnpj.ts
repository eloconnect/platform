/**
 * CNPJ só com letras e dígitos, em maiúsculas, sem pontuação.
 * Ex.: "12.ABC.345/01DE-35" vira "12ABC34501DE35".
 */
export function normalizarCnpj(valor: string): string {
  return valor.replace(/[^0-9a-z]/gi, '').toUpperCase();
}

/**
 * CNPJ com a pontuação de costume, para mostrar na tela.
 * Ex.: "11222333000181" vira "11.222.333/0001-81". Fora do tamanho, volta como veio.
 */
export function formatarCnpj(valor: string): string {
  const cnpj = normalizarCnpj(valor);
  if (cnpj.length !== 14) return valor;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

/**
 * Confere o formato e os dígitos verificadores do CNPJ, com ou sem pontuação.
 * Aceita o CNPJ alfanumérico, emitido pela Receita desde julho de 2026
 * (IN RFB 2.229/2024): os 12 primeiros caracteres podem ter letras, e cada
 * caractere vale o código ASCII menos 48. Para os dígitos, dá o cálculo antigo.
 */
export function cnpjValido(valor: string): boolean {
  const cnpj = normalizarCnpj(valor);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return false;
  if (/^(.)\1+$/.test(cnpj)) return false;
  const dv1 = digitoVerificador(cnpj.slice(0, 12));
  const dv2 = digitoVerificador(cnpj.slice(0, 12) + dv1);
  return cnpj.endsWith(`${dv1}${dv2}`);
}

function digitoVerificador(base: string): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) {
    // Pesos de 2 a 9, da direita para a esquerda, recomeçando depois do 9.
    const peso = ((base.length - 1 - i) % 8) + 2;
    soma += (base.charCodeAt(i) - 48) * peso;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}
