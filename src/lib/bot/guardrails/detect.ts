/**
 * Detecções determinísticas de intenção — rodam ANTES do LLM, custam zero token.
 *
 * Duas delas não podem esperar o modelo: pedido explícito de humano e pedido de
 * parada (opt-out). Se o modelo errar, o cliente fica preso no bot ou recebe
 * mensagem que pediu para não receber.
 *
 * Regra de calibração: na dúvida, NÃO casa. Falso negativo aqui custa uma
 * mensagem a mais; falso positivo silencia o bot para quem só disse "não quero
 * mais pão".
 */

/** Minúsculas e sem acento — "não" e "nao" precisam ser a mesma coisa. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** "quero falar com um atendente", "me passa pra uma pessoa de verdade"… */
const HUMAN_PATTERNS: RegExp[] = [
  /\b(falar|conversar|falar\s+com|falar\s+no)\s+(com\s+)?(um|uma|o|a)?\s*(atendente|humano|pessoa|gente|vendedor|vendedora|responsavel|gerente|dono)\b/,
  /\batendimento\s+humano\b/,
  /\b(pessoa|atendente|alguem)\s+de\s+verdade\b/,
  /\bme\s+(passa|passar|transfere|transferir|encaminha|encaminhar|manda|mandar)\s+(pra|para)\s+(um|uma|o|a)?\s*(atendente|humano|pessoa|gerente)\b/,
  /\bquero\s+(um|uma)\s+(atendente|humano|pessoa)\b/,
];

export function detectHumanRequest(message: string): boolean {
  const text = normalize(message);
  return HUMAN_PATTERNS.some((re) => re.test(text));
}

/**
 * Opt-out exige verbo de COMUNICAÇÃO (receber/mandar/mensagem) ou lista.
 * "não quero mais" sozinho é ambíguo num delivery — costuma significar "não
 * quero mais itens", não "pare de falar comigo".
 */
const OPT_OUT_PATTERNS: RegExp[] = [
  /\b(parar|pare|para)\s+de\s+(me\s+)?(mandar|enviar|avisar|chamar|perturbar)\b/,
  /\bn[ãa]o\s+quero\s+(mais\s+)?(receber|que\s+me\s+mande|ser\s+contatad)/,
  /\bn[ãa]o\s+(me\s+)?(mande|manda|envie|envia)\s+mais\b/,
  /\bme\s+(tira|tirar|retira|retirar|remove|remover)\s+da\s+lista\b/,
  /\bdescadastrar\b/,
  /^(stop|pare|parar)$/,
];

export function detectOptOut(message: string): boolean {
  const text = normalize(message);
  return OPT_OUT_PATTERNS.some((re) => re.test(text));
}

/**
 * Espelha as palavras de confirmação do IntentRouter para que um drift do modelo
 * (pedir confirmação e rotular `confirmar_pedido`) não feche o pedido antes de o
 * cliente confirmar.
 *
 * A versão anterior (`/\bn(ao)?o\b/`) não casava "não" por causa do acento e
 * deixava passar exatamente a recusa. Normalizar antes de testar é o conserto.
 */
export function isExplicitConfirmation(message: string): boolean {
  const text = normalize(message);
  // Qualquer negativa isolada bloqueia. Custa, no pior caso, uma pergunta a
  // mais ("não tenho troco, pode confirmar" → bot confirma de novo); o erro
  // oposto fecha um pedido que o cliente recusou.
  if (/\b(nao|nunca|jamais|nem)\b/.test(text)) return false;
  if (/^(sim|ok|okay|pode|isso|claro|confirmo|beleza|fechado|blz)$/.test(text)) return true;
  return /\b(confirmar|confirmo|pode mandar|pode ser|pode confirmar|ta certo|esta certo|manda ver|isso mesmo|fechar pedido)\b/.test(
    text,
  );
}
