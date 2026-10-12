const firstDigitWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const secondDigitWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function checkDigit(value: string, weights: number[]) {
  const sum = weights.reduce(
    (total, weight, index) => total + (value.charCodeAt(index) - 48) * weight,
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function normalizeCnpj(value: string) {
  return value.replace(/\D/g, '');
}

export function isValidCnpj(value: string) {
  const cnpj = normalizeCnpj(value);
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) {
    return false;
  }

  const firstDigit = checkDigit(cnpj.slice(0, 12), firstDigitWeights);
  if (firstDigit !== Number(cnpj[12])) {
    return false;
  }

  const secondDigit = checkDigit(cnpj.slice(0, 13), secondDigitWeights);
  return secondDigit === Number(cnpj[13]);
}
