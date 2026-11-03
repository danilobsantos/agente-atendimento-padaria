/**
 * Guardião de preço: a única alucinação que custa dinheiro de verdade.
 *
 * O modelo pode inventar um valor mesmo com o cardápio na ferramenta. Como a
 * mensagem final é texto livre, validamos o que ela AFIRMA em R$ contra os
 * valores que existem no catálogo. Se algum valor não existir, a resposta é
 * substituída por uma confirmação segura e o operador é alertado — nunca
 * entregamos um preço que o sistema não reconhece.
 *
 * Escopo deliberado: só `R$`. "10 reais de pão" é o cliente pedindo quantidade,
 * não o bot afirmando preço, e casar isso geraria falso positivo todo dia.
 */

const BRL_RE = /R\$\s*([\d]{1,3}(?:\.[\d]{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi;

/** Converte o token pt-BR para reais. `1.234,56` e `1234.56` valem igual. */
function parseBrl(token: string): number {
  let raw = token;
  const hasComma = raw.includes(",");
  if (hasComma) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    raw = raw.replace(/\./g, "");
  }
  return Number.parseFloat(raw);
}

/** Todos os valores em R$ citados no texto, em centavos. */
export function extractBrlCents(text: string): number[] {
  const out: number[] = [];
  for (const match of text.matchAll(BRL_RE)) {
    const value = parseBrl(match[1]);
    if (Number.isFinite(value)) out.push(Math.round(value * 100));
  }
  return out;
}

export interface PriceGuardResult {
  ok: boolean;
  /** Valores citados que não existem no catálogo (em centavos). */
  offending: number[];
}

/**
 * `allowedCents` deve conter TUDO que a resposta pode legitimamente afirmar:
 * preço de cada produto, de cada adicional, combinações item+adicional, total de
 * cada linha, subtotal, taxa de entrega e total do pedido.
 */
export function checkPrices(message: string, allowedCents: readonly number[]): PriceGuardResult {
  const cited = extractBrlCents(message);
  if (cited.length === 0) return { ok: true, offending: [] };
  const allowed = new Set(allowedCents);
  const offending = cited.filter((v) => !allowed.has(v));
  return { ok: offending.length === 0, offending };
}

/**
 * Prazo é dado que o bot não tem. "Chego em 20 minutos" é promessa que a padaria
 * não fez — e o cliente cobra depois.
 */
const DELIVERY_PROMISE_RE =
  /\b(chego|chegamos|entrego|entregamos|sai|saiu|sai pra|envio|enviamos)\b[^.!?\n]{0,25}?\b(em\s+)?\d{1,3}\s*(min|minuto|minutos|hora|horas)\b/i;

export function hasDeliveryPromise(message: string): boolean {
  return DELIVERY_PROMISE_RE.test(message);
}

/**
 * Remove a(s) frase(s) que prometem prazo. Remove a frase, não a mensagem
 * inteira: o resto da resposta (o que o cliente pediu, a pergunta pendente)
 * continua válido e não precisa ser jogado fora.
 */
const PROMISE_SENTENCE_RE =
  /[^.!?\n]*\b(chego|chegamos|entrego|entregamos|sai|saiu|envio|enviamos)\b[^.!?\n]{0,40}?\b\d{1,3}\s*(min|minuto|minutos|hora|horas)\b[^.!?\n]*[.!?]?/gi;

export function stripDeliveryPromises(message: string): { text: string; removed: boolean } {
  const cleaned = message.replace(PROMISE_SENTENCE_RE, "");
  if (cleaned === message) return { text: message, removed: false };
  return { text: cleaned.replace(/\n{3,}/g, "\n\n").trim(), removed: true };
}
