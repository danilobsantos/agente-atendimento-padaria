export const LOGO_ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "svg"] as const;

export function isAllowedLogoExt(ext: string): boolean {
  return (LOGO_ALLOWED_EXTENSIONS as readonly string[]).includes(ext.toLowerCase());
}

export function isValidCnpj(value: string): boolean {
  const cnpj = value.replace(/\D/g, "");
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const digit = (len: number): number => {
    let sum = 0;
    let weight = len - 7;
    for (let i = 0; i < len; i++) {
      sum += parseInt(cnpj[i]) * weight--;
      if (weight < 2) weight = 9;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return digit(12) === parseInt(cnpj[12]) && digit(13) === parseInt(cnpj[13]);
}

export function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (!digits) return "";

  // Se o número foi digitado no padrão brasileiro sem DDI (10 dígitos com DDD ou 11 dígitos com DDD+9)
  // Adiciona o prefixo 55 para padronizar com o formato padrão do WhatsApp
  if (digits.length === 10 || digits.length === 11) {
    digits = "55" + digits;
  }

  return digits.length >= 10 ? digits : "";
}

/**
 * Retorna variações possíveis de um número de telefone brasileiro para busca flexível no banco
 * Exemplo:
 * - "5535988160553" -> ["5535988160553", "35988160553", "553588160553", "3588160553"]
 */
export function getPhoneLookupVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return [];

  const variants = new Set<string>();
  variants.add(digits);

  // Variação com DDI 55
  if (digits.length === 10 || digits.length === 11) {
    variants.add("55" + digits);
  }

  // Se começa com 55 e tem tamanho de número brasileiro (12 ou 13 dígitos)
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const dddAndNumber = digits.slice(2);
    variants.add(dddAndNumber); // versão sem 55

    // Variação do 9º dígito móvel
    const ddd = dddAndNumber.slice(0, 2);
    const numPart = dddAndNumber.slice(2);

    if (numPart.length === 9 && numPart.startsWith("9")) {
      // 9 dígitos -> cria versão equivalente de 8 dígitos
      const eightDigits = numPart.slice(1);
      variants.add("55" + ddd + eightDigits);
      variants.add(ddd + eightDigits);
    } else if (numPart.length === 8) {
      // 8 dígitos -> cria versão equivalente de 9 dígitos
      const nineDigits = "9" + numPart;
      variants.add("55" + ddd + nineDigits);
      variants.add(ddd + nineDigits);
    }
  }

  return Array.from(variants);
}

