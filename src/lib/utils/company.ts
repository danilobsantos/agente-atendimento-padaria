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
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? digits : "";
}
